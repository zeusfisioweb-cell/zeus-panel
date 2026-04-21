import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
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
