import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensurePatientAccess, handleApiError, requirePanelAccess, resolveScopedProfessionalId } from '../../../_lib';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
});

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        await ensurePatientAccess({ supabase, role, professionalId: scopedProfessionalId, patientId: id });

        let appointmentsQuery = supabase
            .from('appointments')
            .select('*, service:services(name)')
            .eq('patient_id', id);

        let recordsQuery = supabase
            .from('clinical_records')
            .select('*, professional:professionals(profile:profiles(full_name))')
            .eq('patient_id', id);
        const documentsQuery = supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', id);

        if (scopedProfessionalId) {
            appointmentsQuery = appointmentsQuery.eq('professional_id', scopedProfessionalId);
            recordsQuery = recordsQuery.eq('professional_id', scopedProfessionalId);
        }

        const [appointmentsRes, recordsRes, documentsRes] = await Promise.all([
            appointmentsQuery
                .order('start_time', { ascending: false })
                .limit(20),
            recordsQuery
                .order('created_at', { ascending: false }),
            documentsQuery
                .order('document_type', { ascending: true }),
        ]);

        if (appointmentsRes.error) throw appointmentsRes.error;
        if (recordsRes.error) throw recordsRes.error;
        if (documentsRes.error) throw documentsRes.error;

        return NextResponse.json({
            appointments: appointmentsRes.data ?? [],
            records: recordsRes.data ?? [],
            documents: documentsRes.data ?? [],
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
