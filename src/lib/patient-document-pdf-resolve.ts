/**
 * Resolver compartido entre el renderer AcroForm clásico y el renderer overlay.
 * Convierte (fieldName, spec, input) en el string a pintar — la lógica de
 * dónde proviene cada dato (ciudad, fecha, formulario) vive aquí para que
 * ambos pipelines la compartan.
 */
import {
    cityFromAddress,
    dateParts,
    type TemplateSpec,
} from '@/lib/patient-document-templates';
import type { PatientDocumentType } from '@/lib/types';

export interface PatientDocumentPdfInput {
    documentType: PatientDocumentType;
    patientName?: string | null;
    patientDocumentId?: string | null;
    visitDate?: string | null;
    clinicName?: string | null;
    clinicAddress?: string | null;
    formData: Record<string, unknown>;
}

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'SÍ' : 'NO';
    return String(value).trim();
}

function documentIso(input: PatientDocumentPdfInput): string | null {
    const fromForm =
        typeof input.formData.fecha_consentimiento === 'string'
            ? input.formData.fecha_consentimiento
            : null;
    return fromForm ?? input.visitDate ?? null;
}

export function resolvePatientDocumentFieldValue(
    field: string,
    spec: TemplateSpec,
    input: PatientDocumentPdfInput
): string {
    const source = spec.fieldSources[field];
    if (!source) return '';

    if (source.kind === 'config') {
        // Solo `city` queda como config — el resto está horneado en la
        // plantilla. La línea "En ___ el" es muy estrecha, así que nos
        // quedamos sólo con la ciudad sin provincia.
        return cityFromAddress(input.clinicAddress).split(',')[0].trim();
    }

    if (source.kind === 'date') {
        return dateParts(documentIso(input))[source.part];
    }

    const formValue = normalizeText(input.formData[source.key]);
    if (formValue) return formValue;
    if (source.key === 'nombre_firmante') return normalizeText(input.patientName ?? '');
    if (source.key === 'dni_firmante') return normalizeText(input.patientDocumentId ?? '');
    return '';
}
