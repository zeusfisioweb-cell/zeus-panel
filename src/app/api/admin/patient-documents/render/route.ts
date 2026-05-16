import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    assertSameOriginMutation,
    handleApiError,
    requirePanelAccess,
} from '../../_lib';
import { renderPatientDocumentPdf } from '@/lib/patient-document-pdf';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';

export const runtime = 'nodejs';

const schema = z.object({
    document_type: z.enum(['clinical_history', 'intervention_consent', 'data_consent']),
    patient_name: z.string().trim().max(180).optional().nullable(),
    patient_document_id: z.string().trim().max(60).optional().nullable(),
    visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    form_data: z.record(z.string(), z.unknown()).default({}),
});

function slugify(label: string): string {
    return label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase } = await requirePanelAccess();

        const payload = schema.parse(await request.json());

        const { data: settings } = await supabase
            .from('booking_settings')
            .select('clinic_name, address')
            .maybeSingle();

        const bytes = await renderPatientDocumentPdf({
            documentType: payload.document_type,
            patientName: payload.patient_name ?? '',
            patientDocumentId: payload.patient_document_id ?? '',
            visitDate: payload.visit_date ?? null,
            clinicName: settings?.clinic_name ?? null,
            clinicAddress: settings?.address ?? null,
            formData: payload.form_data,
        });

        const label = PATIENT_DOCUMENT_TYPE_LABELS[payload.document_type];
        const fileName = `${slugify(label)}.pdf`;

        return new NextResponse(Buffer.from(bytes), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${fileName}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
