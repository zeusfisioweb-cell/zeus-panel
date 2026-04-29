import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    assertSameOriginMutation,
    ApiRouteError,
    ensurePatientAccess,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de historia clínica inválido' }),
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
        assertSameOriginMutation(_request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const ip = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(`${userId}:${ip}`, 'admin-delete-clinical-record', 40, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }

        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        const { data: record, error: recordError } = await supabase
            .from('clinical_records')
            .select('id, patient_id, professional_id')
            .eq('id', id)
            .maybeSingle();

        if (recordError) throw recordError;
        if (!record) throw new ApiRouteError(404, 'Clinical record not found');

        const clinicalRecord = record as ClinicalRecordAccessRow;

        await ensurePatientAccess({
            supabase,
            role,
            professionalId: scopedProfessionalId,
            patientId: clinicalRecord.patient_id,
        });

        if (scopedProfessionalId && clinicalRecord.professional_id !== scopedProfessionalId) {
            throw new ApiRouteError(403, 'Forbidden');
        }

        let deleteQuery = supabase
            .from('clinical_records')
            .delete()
            .eq('id', id);

        if (scopedProfessionalId) {
            deleteQuery = deleteQuery.eq('professional_id', scopedProfessionalId);
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
