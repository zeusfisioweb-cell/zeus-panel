import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, getAdminSupabase, handleApiError, requirePanelAccess, writeAuditLog } from '../../../_lib';
import { checkRateLimit, getRetryAfterSeconds, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit';
import { sendProfessionalWelcomeEmail } from '@/lib/email';

const ParamsSchema = z.object({
    id: z.string().uuid({ message: 'ID de profesional inválido' }),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId: ownerUserId } = await requirePanelAccess({ ownerOnly: true });

        const { success, reset } = await checkRateLimit(ownerUserId, 'resend-welcome', 30, 3600);
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
            .select('id, profile:profiles(email, full_name)')
            .eq('id', professionalId)
            .single();

        if (lookupError || !professional) {
            return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
        }

        const profile = Array.isArray(professional.profile) ? professional.profile[0] : professional.profile;
        const email = profile?.email;
        const fullName = profile?.full_name || 'Profesional';

        if (!email) {
            return NextResponse.json({ error: 'El profesional no tiene email registrado' }, { status: 422 });
        }

        const adminAuthClient = getAdminSupabase();

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        const redirectTo = appUrl ? `${new URL(appUrl).origin}/auth/set-password` : undefined;

        const { data: linkData, error: linkError } = await adminAuthClient.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: redirectTo ? { redirectTo } : undefined,
        });

        if (linkError || !linkData?.properties?.action_link) {
            console.error('Failed to generate recovery link for professional:', linkError);
            return NextResponse.json({ error: 'No se pudo generar el enlace de acceso' }, { status: 500 });
        }

        try {
            await sendProfessionalWelcomeEmail({
                to: email,
                fullName,
                setupLink: linkData.properties.action_link,
            });
        } catch (emailErr) {
            console.error('Failed to send professional welcome email:', emailErr);
            return NextResponse.json({ error: 'No se pudo enviar el correo' }, { status: 502 });
        }

        await writeAuditLog({
            supabase,
            userId: ownerUserId,
            action: 'UPDATE',
            tableName: 'professionals',
            recordId: professionalId,
            details: { action: 'resend_welcome_email', email },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
