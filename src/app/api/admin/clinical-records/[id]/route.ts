import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, ensurePatientAccess, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

interface ClinicalRecordAccessRow {
    id: string;
    patient_id: string;
    professional_id: string | null;
}

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, role, userId } = await requirePanelAccess();
        const { id } = paramsSchema.parse(await context.params);

        const { data: record, error: recordError } = await supabase
            .from('clinical_records')
            .select('id, patient_id, professional_id')
            .eq('id', id)
            .maybeSingle();

        if (recordError) throw recordError;
        if (!record) throw new ApiRouteError(404, 'Clinical record not found');

        const clinicalRecord = record as ClinicalRecordAccessRow;

        await ensurePatientAccess({ supabase, role, userId, patientId: clinicalRecord.patient_id });

        if (role === 'professional' && clinicalRecord.professional_id !== userId) {
            throw new ApiRouteError(403, 'Forbidden');
        }

        let deleteQuery = supabase
            .from('clinical_records')
            .delete()
            .eq('id', id);

        if (role === 'professional') {
            deleteQuery = deleteQuery.eq('professional_id', userId);
        }

        const { error } = await deleteQuery;

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'clinical_records',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
