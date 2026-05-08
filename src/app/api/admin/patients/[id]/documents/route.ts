import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ensurePatientAccess,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
} from '../../../_lib';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
});

const DOCUMENT_DEFAULTS = [
    {
        document_type: 'clinical_history',
        title: 'Historia clínica fisioterapéutica',
        template_file_name: 'historia_clinica_fisioterapeutica_template.pdf',
    },
    {
        document_type: 'intervention_consent',
        title: 'Consentimiento de intervención',
        template_file_name: 'consentimiento_intervencion_template.pdf',
    },
    {
        document_type: 'data_consent',
        title: 'Consentimiento LOPD/RGPD',
        template_file_name: 'consentimiento_lopd_template.pdf',
    },
] as const;

type DocumentType = (typeof DOCUMENT_DEFAULTS)[number]['document_type'];

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, role, professionalId, userId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id: patientId } = paramsSchema.parse(await context.params);

        await ensurePatientAccess({
            supabase,
            role,
            professionalId: scopedProfessionalId,
            patientId,
        });

        const { data: existingDocuments, error: existingError } = await supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: true });

        if (existingError) throw existingError;

        const existingByType = new Set(
            (existingDocuments ?? []).map((doc) => doc.document_type as DocumentType)
        );

        const missing = DOCUMENT_DEFAULTS.filter((doc) => !existingByType.has(doc.document_type));

        if (missing.length > 0) {
            const payload = missing.map((doc) => ({
                patient_id: patientId,
                document_type: doc.document_type,
                title: doc.title,
                template_file_name: doc.template_file_name,
                created_by: userId,
                updated_by: userId,
            }));

            const { error: insertError } = await supabase
                .from('patient_documents')
                .upsert(payload, { onConflict: 'patient_id,document_type' });

            if (insertError) throw insertError;
        }

        const { data, error } = await supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', patientId)
            .order('document_type', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ documents: data ?? [] });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
