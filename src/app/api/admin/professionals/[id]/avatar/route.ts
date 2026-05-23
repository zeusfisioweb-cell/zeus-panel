import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, getAdminSupabase, handleApiError, requirePanelAccess, writeAuditLog } from '../../../_lib';
import { checkRateLimit, getRetryAfterSeconds, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit';

const ParamsSchema = z.object({
    id: z.string().uuid({ message: 'ID de profesional inválido' }),
});

const BUCKET = 'professional-avatars';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId: ownerUserId } = await requirePanelAccess({ ownerOnly: true });

        const { success, reset } = await checkRateLimit(ownerUserId, 'avatar-upload', 30, 3600);
        if (!success) {
            return NextResponse.json(
                { error: RATE_LIMIT_MESSAGE },
                { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(reset)) } }
            );
        }

        const resolvedParams = await context.params;
        const validation = ParamsSchema.safeParse(resolvedParams);
        if (!validation.success) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }
        const { id: professionalId } = validation.data;

        const { data: professional, error: lookupError } = await supabase
            .from('professionals')
            .select('id, avatar_url')
            .eq('id', professionalId)
            .maybeSingle();

        if (lookupError) throw lookupError;
        if (!professional) {
            return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Formato no permitido (JPG, PNG, WEBP)' }, { status: 415 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: 'Archivo demasiado grande (máx 2 MB)' }, { status: 413 });
        }

        const adminClient = getAdminSupabase();
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const objectPath = `${professionalId}/${Date.now()}.${ext}`;
        const arrayBuffer = await file.arrayBuffer();

        const { error: uploadError } = await adminClient.storage
            .from(BUCKET)
            .upload(objectPath, arrayBuffer, {
                contentType: file.type,
                upsert: false,
                cacheControl: '3600',
            });

        if (uploadError) {
            console.error('Avatar upload failed:', uploadError);
            return NextResponse.json({ error: 'No se pudo subir la imagen' }, { status: 500 });
        }

        const { data: publicUrlData } = adminClient.storage.from(BUCKET).getPublicUrl(objectPath);
        const avatarUrl = publicUrlData.publicUrl;

        const { error: updateError } = await adminClient
            .from('professionals')
            .update({ avatar_url: avatarUrl })
            .eq('id', professionalId);

        if (updateError) {
            console.error('Avatar column update failed:', updateError);
            return NextResponse.json({ error: 'No se pudo guardar la URL del avatar' }, { status: 500 });
        }

        if (professional.avatar_url) {
            const prevPath = extractObjectPath(professional.avatar_url, BUCKET);
            if (prevPath) {
                await adminClient.storage.from(BUCKET).remove([prevPath]).catch(() => undefined);
            }
        }

        await writeAuditLog({
            supabase,
            userId: ownerUserId,
            action: 'UPDATE',
            tableName: 'professionals',
            recordId: professionalId,
            details: { action: 'avatar_upload', object_path: objectPath },
        });

        return NextResponse.json({ success: true, avatar_url: avatarUrl });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

function extractObjectPath(publicUrl: string, bucket: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
}
