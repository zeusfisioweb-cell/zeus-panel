import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { RecordType } from '@/lib/types';
import { ensurePatientAccess, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';

const recordTypeSchema = z.enum(['anamnesis', 'exploration', 'evolution', 'report']) as z.ZodType<RecordType>;

const createClinicalRecordSchema = z.object({
    patient_id: z.string().min(1),
    type: recordTypeSchema,
    content: z.record(z.string(), z.string()),
});

export async function POST(request: Request) {
    try {
        const { supabase, role, userId } = await requirePanelAccess();
        const rawBody = await request.json();
        const parsed = createClinicalRecordSchema.parse(rawBody);

        await ensurePatientAccess({ supabase, role, userId, patientId: parsed.patient_id });

        const { data, error } = await supabase
            .from('clinical_records')
            .insert({
                patient_id: parsed.patient_id,
                professional_id: userId,
                type: parsed.type,
                content: parsed.content,
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
