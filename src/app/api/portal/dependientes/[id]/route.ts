import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiRouteError, assertSameOriginMutation, getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'portal-delete-dependiente', 12, 3600);
        if (!rl.success) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
                }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const { id } = paramsSchema.parse(await context.params);
        const adminSupabase = getAdminSupabase();

        // Verify ownership before soft delete
        const { data: dep } = await adminSupabase
            .from('patients')
            .select('id, guardian_auth_user_id')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();

        if (!dep || dep.guardian_auth_user_id !== user.id) {
            return NextResponse.json({ error: 'No encontrado o sin permisos' }, { status: 404 });
        }

        const { error } = await adminSupabase
            .from('patients')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) return NextResponse.json({ error: 'Error al eliminar dependiente' }, { status: 500 });

        const { error: auditError } = await adminSupabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'DELETE',
            table_name: 'patients',
            record_id: id,
            details: { source: 'portal_dependiente_delete', soft_delete: true, guardian_auth_user_id: user.id },
        });
        if (auditError) {
            throw new ApiRouteError(500, 'Audit log failed');
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleApiError(error);
    }
}
