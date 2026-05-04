import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { RecordType } from '@/lib/types';
import { validateClinicalContent } from '@/lib/clinical-content-schemas';
import {
    assertSameOriginMutation,
    ApiRouteError,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../_lib';
const recordTypeSchema = z.enum(['anamnesis', 'exploration', 'evolution', 'report']) as z.ZodType<RecordType>;

const createClinicalRecordSchema = z.object({
    patient_id: z.string().uuid({ message: 'ID de paciente inválido' }),
    type: recordTypeSchema,
    content: z.record(z.string(), z.unknown()),
    professional_id: z.string().uuid({ message: 'ID de profesional inválido' }).optional(),
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const rawBody = await request.json();
        const parsed = createClinicalRecordSchema.parse(rawBody);

        const contentValidation = validateClinicalContent(parsed.type, parsed.content);
        if (!contentValidation.success) {
            return NextResponse.json(
                {
                    error: 'Invalid content for record type',
                    details: contentValidation.error.flatten().fieldErrors,
                },
                { status: 422 }
            );
        }
        const clinicalContent = contentValidation.data;

        // Patient existence is enforced by the DB FK constraint.
        // Professional access is enforced by the RLS INSERT policy.
        // ensurePatientAccess is intentionally skipped here so professionals
        // can create the first clinical record for a patient they are seeing
        // for the first time (creating the record establishes the relationship).

        let targetProfessionalId = scopedProfessionalId;

        if (!targetProfessionalId) {
            if (!parsed.professional_id) {
                throw new ApiRouteError(400, 'professional_id is required for owner');
            }

            const { data: professional, error: professionalError } = await supabase
                .from('professionals')
                .select('id, is_active')
                .eq('id', parsed.professional_id)
                .maybeSingle();

            if (professionalError) throw professionalError;
            if (!professional || !professional.is_active) {
                throw new ApiRouteError(400, 'Invalid professional_id');
            }

            targetProfessionalId = professional.id as string;
        }

        const { data, error } = await supabase
            .from('clinical_records')
            .insert({
                patient_id: parsed.patient_id,
                professional_id: targetProfessionalId,
                type: parsed.type,
                content: clinicalContent,
            })
            .select()
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'clinical_records',
            recordId: data.id,
            details: { type: parsed.type },
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
