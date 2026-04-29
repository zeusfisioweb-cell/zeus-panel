import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(_request);
        const ip = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'delete-patient', 10, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }
        // Only owners can delete (soft-delete) patients
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);

        // soft_delete_patient: sets deleted_at, preserves consent_records (GDPR compliance)
        const { error } = await supabase.rpc('soft_delete_patient', { patient_id_input: id });
        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'patients',
            recordId: id,
            details: { soft_delete: true },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
