import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, type PDFFont, rgb } from 'pdf-lib';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import type { PatientDocumentType } from '@/lib/types';

type FieldKind = 'line' | 'area';

interface FieldPlacement {
    key: string;
    kind: FieldKind;
    page: number;
    x: number;
    y: number;
    maxWidth: number;
    fontSize: number;
    lineHeight: number;
    maxLines?: number;
    clearHeight?: number;
}

export interface PatientDocumentPdfInput {
    documentType: PatientDocumentType;
    patientName?: string | null;
    patientDocumentId?: string | null;
    visitDate?: string | null;
    formData: Record<string, unknown>;
}

function clinicalHistoryLayout(): FieldPlacement[] {
    return [
        { key: 'fecha_primera_visita', kind: 'line', page: 0, x: 156, y: 722, maxWidth: 250, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: '__patient_name', kind: 'line', page: 0, x: 170, y: 672, maxWidth: 300, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'edad', kind: 'line', page: 0, x: 145, y: 647, maxWidth: 60, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'sexo', kind: 'line', page: 0, x: 145, y: 634, maxWidth: 140, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'ocupacion', kind: 'line', page: 0, x: 168, y: 621, maxWidth: 250, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'motivo_consulta', kind: 'area', page: 0, x: 102, y: 583, maxWidth: 430, fontSize: 9.5, lineHeight: 10.5, maxLines: 3, clearHeight: 34 },
        { key: 'antecedentes_personales', kind: 'area', page: 0, x: 102, y: 516, maxWidth: 430, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 22 },
        { key: 'historial_familiar', kind: 'line', page: 0, x: 188, y: 475, maxWidth: 344, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'sintomatologia', kind: 'area', page: 0, x: 102, y: 416, maxWidth: 430, fontSize: 9.5, lineHeight: 10.5, maxLines: 5, clearHeight: 52 },
        { key: 'peso', kind: 'line', page: 0, x: 145, y: 341, maxWidth: 80, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'altura', kind: 'line', page: 0, x: 145, y: 329, maxWidth: 80, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'tipo', kind: 'line', page: 0, x: 145, y: 316, maxWidth: 170, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'frecuencia_ejercicio', kind: 'line', page: 0, x: 280, y: 303, maxWidth: 252, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'efectos_lesion', kind: 'area', page: 0, x: 102, y: 267, maxWidth: 430, fontSize: 9.5, lineHeight: 10.5, maxLines: 3, clearHeight: 34 },
        { key: 'descripcion_sintomas', kind: 'area', page: 0, x: 102, y: 208, maxWidth: 430, fontSize: 9.5, lineHeight: 10.5, maxLines: 3, clearHeight: 34 },
        { key: 'valoracion_movilidad', kind: 'area', page: 0, x: 102, y: 150, maxWidth: 430, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 24 },
        { key: 'pruebas_diagnosticas', kind: 'line', page: 0, x: 72, y: 104, maxWidth: 460, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },

        { key: 'diagnostico', kind: 'area', page: 1, x: 72, y: 749, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 24 },
        { key: 'tratamiento_recomendado', kind: 'area', page: 1, x: 72, y: 702, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 24 },
        { key: 'evolucion', kind: 'area', page: 1, x: 72, y: 654, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 24 },
    ];
}

function interventionConsentLayout(): FieldPlacement[] {
    return [
        { key: 'fecha_consentimiento', kind: 'line', page: 4, x: 140, y: 741, maxWidth: 190, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'nombre_firmante', kind: 'line', page: 4, x: 122, y: 652, maxWidth: 190, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'dni_firmante', kind: 'line', page: 4, x: 260, y: 652, maxWidth: 110, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'nombre_tutor', kind: 'line', page: 4, x: 244, y: 204, maxWidth: 140, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'dni_tutor', kind: 'line', page: 4, x: 370, y: 204, maxWidth: 120, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
    ];
}

function dataConsentLayout(): FieldPlacement[] {
    return [
        { key: 'fecha_consentimiento', kind: 'line', page: 0, x: 150, y: 287, maxWidth: 190, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'nombre_firmante', kind: 'line', page: 0, x: 122, y: 197, maxWidth: 190, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'dni_firmante', kind: 'line', page: 0, x: 260, y: 197, maxWidth: 110, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'nombre_tutor', kind: 'line', page: 1, x: 122, y: 614, maxWidth: 220, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
        { key: 'dni_tutor', kind: 'line', page: 1, x: 350, y: 614, maxWidth: 130, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 12 },
    ];
}

function getLayout(documentType: PatientDocumentType): FieldPlacement[] {
    if (documentType === 'clinical_history') {
        return clinicalHistoryLayout();
    }
    if (documentType === 'intervention_consent') {
        return interventionConsentLayout();
    }
    return dataConsentLayout();
}

function toDateEs(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [yyyy, mmv, dd] = value.split('-');
        return `${dd}/${mmv}/${yyyy}`;
    }
    return value;
}

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'SI' : 'NO';
    return String(value).trim();
}

function fieldValue(key: string, input: PatientDocumentPdfInput): string {
    if (key === '__patient_name') {
        return normalizeText(input.patientName ?? '');
    }
    if (key === '__patient_document_id') {
        return normalizeText(input.patientDocumentId ?? '');
    }

    const raw = normalizeText(input.formData[key]);
    if (!raw) return '';
    if (key.startsWith('fecha_')) {
        return toDateEs(raw);
    }
    return raw;
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number, maxLines: number): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';
    let consumed = 0;

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
            current = candidate;
            consumed += 1;
            continue;
        }
        if (current) {
            lines.push(current);
            if (lines.length >= maxLines) break;
        }
        current = word;
        consumed += 1;
    }

    if (lines.length < maxLines && current) {
        lines.push(current);
    }

    if (lines.length > maxLines) {
        return lines.slice(0, maxLines);
    }

    if (lines.length === maxLines && consumed < words.length) {
        const last = lines[maxLines - 1] ?? '';
        let cut = last;
        while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, fontSize) > maxWidth) {
            cut = cut.slice(0, -1);
        }
        lines[maxLines - 1] = `${cut}...`;
    }

    return lines;
}

function fitText(text: string, placement: FieldPlacement, font: PDFFont): string {
    const maxLines = placement.maxLines ?? 1;
    const lines = wrapLines(text, font, placement.fontSize, placement.maxWidth, maxLines);
    return lines.join('\n');
}

export async function renderPatientDocumentPdf(input: PatientDocumentPdfInput): Promise<Uint8Array> {
    const template = PATIENT_DOCUMENT_DEFINITIONS[input.documentType].templateFileName;
    const templatePath = path.join(process.cwd(), 'public', 'consentimientos', template);
    const templateBytes = await readFile(templatePath);

    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const placements = getLayout(input.documentType);

    for (const placement of placements) {
        const page = pdfDoc.getPage(placement.page);
        if (!page) continue;

        const value = fieldValue(placement.key, input);
        if (!value) continue;

        if (placement.clearHeight && placement.clearHeight > 0) {
            page.drawRectangle({
                x: placement.x - 2,
                y: placement.y - 2,
                width: placement.maxWidth + 4,
                height: placement.clearHeight,
                color: rgb(1, 1, 1),
                borderWidth: 0,
            });
        }

        const text = fitText(value, placement, font);
        if (!text) continue;

        page.drawText(text, {
            x: placement.x,
            y: placement.y,
            font,
            size: placement.fontSize,
            lineHeight: placement.lineHeight,
            maxWidth: placement.maxWidth,
            color: rgb(0, 0, 0),
        });
    }

    return pdfDoc.save();
}
