import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, assertSameOriginMutation, getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';
import { verifyCancelToken } from '@/lib/portal-token';
import { checkRateLimit } from '@/lib/rate-limit';

const bodySchema = z.object({
    token: z.string().min(20),
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'portal-cancel-confirm', 8, 3600);
        if (!rl.success) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
                }
            );
        }

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) {
            throw new ApiRouteError(400, 'Token inválido');
        }

        const { aptId, patientId, actorUserId } = await verifyCancelToken(parsed.data.token);
        const adminSupabase = getAdminSupabase();

        const { data, error } = await adminSupabase
            .from('appointments')
            .update({
                status: 'cancelled',
                cancellation_reason: 'Cancelado por el paciente desde el portal',
                updated_at: new Date().toISOString(),
            })
            .eq('id', aptId)
            .eq('patient_id', patientId)
            .in('status', ['pending', 'confirmed'])
            .select('id')
            .maybeSingle();

        if (error) {
            throw new ApiRouteError(500, 'No fue posible procesar la cancelación');
        }

        if (!data) {
            return NextResponse.json({ ok: true, status: 'already-cancelled' as const });
        }

        let auditUserId = actorUserId;
        if (!auditUserId) {
            const { data: patient, error: patientError } = await adminSupabase
                .from('patients')
                .select('auth_user_id')
                .eq('id', patientId)
                .maybeSingle();
            if (!patientError) {
                auditUserId = patient?.auth_user_id ?? null;
            }
        }

        if (!auditUserId) {
            console.error('[portal-cancel-confirm] Missing audit user id for appointment:', aptId);
            return NextResponse.json({ ok: true, status: 'success' as const });
        }

        const { error: auditError } = await adminSupabase.from('audit_logs').insert({
            user_id: auditUserId,
            action: 'UPDATE',
            table_name: 'appointments',
            record_id: aptId,
            details: { source: 'portal_cancel_confirm' },
        });

        if (auditError) {
            console.error('[portal-cancel-confirm] Audit insert failed:', auditError.message);
        }

        return NextResponse.json({ ok: true, status: 'success' as const });
    } catch (error) {
        return handleApiError(error);
    }
}
