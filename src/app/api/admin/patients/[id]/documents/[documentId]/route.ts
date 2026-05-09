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
} from '../../../../_lib';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
    documentId: z.string().uuid({ message: 'ID de documento inválido' }),
});

const payloadSchema = z.object({
    status: z.enum(['draft', 'completed', 'signed']).optional(),
    form_data: z.record(z.string(), z.unknown()).optional(),
    file_url: z.string().trim().url().nullable().optional(),
    visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string; documentId: string }> }
) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);

        const { id: patientId, documentId } = paramsSchema.parse(await context.params);
        await ensurePatientAccess({
            supabase,
            role,
            professionalId: scopedProfessionalId,
            patientId,
        });

        const body = payloadSchema.parse(await request.json());

        const { data: existing, error: existingError } = await supabase
            .from('patient_documents')
            .select('id, patient_id, status')
            .eq('id', documentId)
            .eq('patient_id', patientId)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existing) throw new ApiRouteError(404, 'Documento no encontrado');

        const nowIso = new Date().toISOString();
        const nextStatus = body.status ?? existing.status;
        const updatePayload: Record<string, unknown> = {
            updated_by: userId,
        };

        if ('status' in body) {
            updatePayload.status = body.status;
        }
        if ('form_data' in body) {
            updatePayload.form_data = body.form_data ?? {};
        }
        if ('file_url' in body) {
            updatePayload.file_url = body.file_url ?? null;
        }
        if ('visit_date' in body) {
            updatePayload.visit_date = body.visit_date ?? null;
        }

        if (nextStatus === 'completed' && existing.status !== 'completed') {
            updatePayload.completed_at = nowIso;
        }
        if (nextStatus === 'signed' && existing.status !== 'signed') {
            updatePayload.signed_at = nowIso;
            if (existing.status !== 'completed') {
                updatePayload.completed_at = nowIso;
            }
        }

        const { data: updated, error: updateError } = await supabase
            .from('patient_documents')
            .update(updatePayload)
            .eq('id', documentId)
            .eq('patient_id', patientId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'patient_documents',
            recordId: documentId,
            details: {
                status: updated.status,
                changed_fields: Object.keys(body),
            },
        });

        return NextResponse.json(updated);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string; documentId: string }> }
) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);

        const { id: patientId, documentId } = paramsSchema.parse(await context.params);
        await ensurePatientAccess({
            supabase,
            role,
            professionalId: scopedProfessionalId,
            patientId,
        });

        const { error: deleteError } = await supabase
            .from('patient_documents')
            .delete()
            .eq('id', documentId)
            .eq('patient_id', patientId);

        if (deleteError) throw deleteError;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'patient_documents',
            recordId: documentId,
            details: { patient_id: patientId },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
