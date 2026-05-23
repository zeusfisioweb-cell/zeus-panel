/**
 * Resolver compartido entre el renderer AcroForm clásico y el renderer overlay.
 * Convierte (fieldName, spec, input) en el string a pintar — la lógica de
 * dónde proviene cada dato (config clínica, fecha, paciente, formulario) vive
 * aquí para que ambos pipelines la compartan.
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
    if (field === 'historia_fecha') {
        const { day, month, year } = dateParts(documentIso(input));
        const city = cityFromAddress(input.clinicAddress);
        return `En ${city} el ${day} de ${month} de ${year}`;
    }

    const source = spec.fieldSources[field];
    if (!source) return '';

    if (source.kind === 'config') {
        if (source.key === 'clinic_name') return normalizeText(input.clinicName ?? '');
        if (source.key === 'address') return normalizeText(input.clinicAddress ?? '');
        const city = cityFromAddress(input.clinicAddress);
        // El hueco "En ___ el" es muy estrecho; nos quedamos sólo con la
        // ciudad sin provincia para que quepa al tamaño de prosa.
        if (field === 'lugar') return city.split(',')[0].trim();
        return city;
    }

    if (source.kind === 'date') {
        return dateParts(documentIso(input))[source.part];
    }

    if (source.kind === 'patient') {
        const name = normalizeText(input.patientName ?? '');
        if (source.key === 'document_id') return normalizeText(input.patientDocumentId ?? '');
        const parts = name.split(/\s+/).filter(Boolean);
        if (source.key === 'name_first') return parts[0] ?? '';
        return parts.slice(1).join(' ');
    }

    const formValue = normalizeText(input.formData[source.key]);
    if (formValue) return formValue;
    if (source.key === 'nombre_firmante') return normalizeText(input.patientName ?? '');
    if (source.key === 'dni_firmante') return normalizeText(input.patientDocumentId ?? '');
    return '';
}
