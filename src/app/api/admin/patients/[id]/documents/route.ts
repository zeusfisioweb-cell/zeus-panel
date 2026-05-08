import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ensurePatientAccess,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    assertSameOriginMutation,
} from '../../../_lib';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
});

const DOCUMENT_DEFAULTS: Record<string, { title: string; template_file_name: string }> = {
    clinical_history: {
        title: 'Historia clínica fisioterapéutica',
        template_file_name: 'historia_clinica_fisioterapeutica_template.pdf',
    },
    intervention_consent: {
        title: 'Consentimiento de intervención',
        template_file_name: 'consentimiento_intervencion_template.pdf',
    },
    data_consent: {
        title: 'Consentimiento LOPD/RGPD',
        template_file_name: 'consentimiento_lopd_template.pdf',
    },
};

const createSchema = z.object({
    document_type: z.enum(['clinical_history', 'intervention_consent', 'data_consent']),
    visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    form_data: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id: patientId } = paramsSchema.parse(await context.params);

        await ensurePatientAccess({
            supabase,
            role,
            professionalId: scopedProfessionalId,
            patientId,
        });

        const { data, error } = await supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ documents: data ?? [] });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id: patientId } = paramsSchema.parse(await context.params);

        await ensurePatientAccess({
            supabase,
            role,
            professionalId: scopedProfessionalId,
            patientId,
        });

        const body = createSchema.parse(await request.json());
        const defaults = DOCUMENT_DEFAULTS[body.document_type];

        const { data, error } = await supabase
            .from('patient_documents')
            .insert({
                patient_id: patientId,
                document_type: body.document_type,
                title: defaults.title,
                template_file_name: defaults.template_file_name,
                status: 'draft',
                form_data: body.form_data ?? {},
                notes: body.notes ?? null,
                visit_date: body.visit_date ?? null,
                created_by: userId,
                updated_by: userId,
            })
            .select('*')
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
