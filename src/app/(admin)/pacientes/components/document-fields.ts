import type { PatientDocumentType } from '@/lib/types';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { getDocumentFields } from '@/lib/patient-document-definitions';

export const DOCUMENT_FIELDS: Record<PatientDocumentType, ReturnType<typeof getDocumentFields>> = {
    clinical_history: getDocumentFields('clinical_history'),
    intervention_consent: getDocumentFields('intervention_consent'),
    data_consent: getDocumentFields('data_consent'),
};

export const DOCUMENT_TYPE_OPTIONS = (Object.keys(DOCUMENT_FIELDS) as PatientDocumentType[]).map(
    (type) => ({ value: type, label: PATIENT_DOCUMENT_TYPE_LABELS[type] })
);

export interface PrintDocumentParams {
    documentType: PatientDocumentType;
    patientName: string;
    patientDocumentId?: string | null;
    visitDate: string;
    formData: Record<string, unknown>;
}

export async function printDocument({
    documentType,
    patientName,
    patientDocumentId,
    visitDate,
    formData,
}: PrintDocumentParams): Promise<void> {
    const response = await fetch('/api/admin/patient-documents/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            document_type: documentType,
            patient_name: patientName || null,
            patient_document_id: patientDocumentId || null,
            visit_date: visitDate || null,
            form_data: formData ?? {},
        }),
    });

    if (!response.ok) {
        let message = 'No se pudo generar el PDF';
        try {
            const data = (await response.json()) as { error?: string };
            if (data.error) message = data.error;
        } catch {
            // noop: fallback message already set
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `${PATIENT_DOCUMENT_TYPE_LABELS[documentType]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
