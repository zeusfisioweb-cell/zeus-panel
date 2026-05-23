import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, assertSameOriginMutation, getAdminSupabase, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';
const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(_request);
        // Only owners can delete (soft-delete) patients
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);

        const adminClient = getAdminSupabase();
        const nowIso = new Date().toISOString();

        const { data: updatedPatient, error: softDeleteError } = await adminClient
            .from('patients')
            .update({ deleted_at: nowIso, updated_at: nowIso })
            .eq('id', id)
            .is('deleted_at', null)
            .select('id')
            .maybeSingle();
        if (softDeleteError) throw softDeleteError;
        if (!updatedPatient) {
            throw new ApiRouteError(404, 'Patient not found or already deleted');
        }

        const { error: detachAppointmentsError } = await adminClient
            .from('appointments')
            .update({ patient_id: null, updated_at: nowIso })
            .eq('patient_id', id)
            .gt('start_time', nowIso)
            .not('status', 'in', '(cancelled,completed)');
        if (detachAppointmentsError) throw detachAppointmentsError;

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
