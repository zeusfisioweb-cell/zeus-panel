import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ensurePatientAccess,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    assertSameOriginMutation,
} from '../../../_lib';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import { sanitizeDocumentFormData } from '@/lib/patient-document-definitions';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
});

const createSchema = z.object({
    document_type: z.enum(['clinical_history', 'intervention_consent', 'data_consent']),
    visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
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
        const defaults = PATIENT_DOCUMENT_DEFINITIONS[body.document_type];

        const { data, error } = await supabase
            .from('patient_documents')
            .insert({
                patient_id: patientId,
                document_type: body.document_type,
                title: defaults.title,
                template_file_name: defaults.templateFileName,
                status: 'draft',
                form_data: sanitizeDocumentFormData(body.document_type, body.form_data),
                notes: null,
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
