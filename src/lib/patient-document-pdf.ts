import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import {
    PATIENT_DOCUMENT_TEMPLATES,
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

function resolveFieldValue(
    field: string,
    spec: TemplateSpec,
    input: PatientDocumentPdfInput
): string {
    // Composed date/place sentence used by the clinical-history template.
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
        return cityFromAddress(input.clinicAddress);
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

async function fillTemplate(
    spec: TemplateSpec,
    input: PatientDocumentPdfInput
): Promise<Uint8Array> {
    const templateFile = PATIENT_DOCUMENT_DEFINITIONS[input.documentType].templateFileName;
    const templatePath = path.join(process.cwd(), 'public', 'consentimientos', templateFile);
    const pdfDoc = await PDFDocument.load(await readFile(templatePath));
    const form = pdfDoc.getForm();

    for (const acroField of form.getFields()) {
        const name = acroField.getName();
        const value = resolveFieldValue(name, spec, input);
        if (!value) continue;
        form.getTextField(name).setText(value);
    }

    form.flatten();
    return pdfDoc.save();
}

export async function renderPatientDocumentPdf(
    input: PatientDocumentPdfInput
): Promise<Uint8Array> {
    const spec = PATIENT_DOCUMENT_TEMPLATES[input.documentType];
    if (!spec) {
        throw new Error(`No template configured for document type ${input.documentType}`);
    }
    return fillTemplate(spec, input);
}
