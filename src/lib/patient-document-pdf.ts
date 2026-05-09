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
    prefix?: string;
    alwaysDraw?: boolean;
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
        { key: 'fecha_primera_visita', kind: 'line', page: 0, x: 72, y: 722, maxWidth: 280, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'En Torrijos el ', alwaysDraw: true },
        { key: '__patient_first_name', kind: 'line', page: 0, x: 102, y: 672, maxWidth: 220, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Nombre:', alwaysDraw: true },
        { key: '__patient_last_name', kind: 'line', page: 0, x: 102, y: 659, maxWidth: 300, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Apellidos:', alwaysDraw: true },
        { key: 'edad', kind: 'line', page: 0, x: 102, y: 646, maxWidth: 90, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Edad:', alwaysDraw: true },
        { key: 'sexo', kind: 'line', page: 0, x: 102, y: 634, maxWidth: 180, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Sexo: ', alwaysDraw: true },
        { key: 'ocupacion', kind: 'line', page: 0, x: 102, y: 621, maxWidth: 320, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Ocupación: ', alwaysDraw: true },

        { key: 'motivo_consulta', kind: 'area', page: 0, x: 72, y: 571, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 3, clearHeight: 38 },
        { key: 'antecedentes_personales', kind: 'area', page: 0, x: 72, y: 497, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 28 },
        { key: 'historial_familiar', kind: 'line', page: 0, x: 72, y: 452, maxWidth: 460, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14 },
        { key: 'sintomatologia', kind: 'area', page: 0, x: 72, y: 405, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 5, clearHeight: 62 },

        { key: 'peso', kind: 'line', page: 0, x: 102, y: 341, maxWidth: 120, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Peso:', alwaysDraw: true },
        { key: 'altura', kind: 'line', page: 0, x: 102, y: 329, maxWidth: 120, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Altura:', alwaysDraw: true },
        { key: 'tipo', kind: 'line', page: 0, x: 102, y: 316, maxWidth: 220, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Tipo:', alwaysDraw: true },
        { key: 'frecuencia_ejercicio', kind: 'line', page: 0, x: 102, y: 303, maxWidth: 430, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14, prefix: 'Frecuencia de ejercicio físico: ', alwaysDraw: true },

        { key: 'efectos_lesion', kind: 'area', page: 0, x: 72, y: 244, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 3, clearHeight: 38 },
        { key: 'descripcion_sintomas', kind: 'area', page: 0, x: 72, y: 186, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 3, clearHeight: 38 },
        { key: 'valoracion_movilidad', kind: 'area', page: 0, x: 72, y: 140, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 28 },
        { key: 'pruebas_diagnosticas', kind: 'line', page: 0, x: 72, y: 93, maxWidth: 460, fontSize: 10, lineHeight: 11, maxLines: 1, clearHeight: 14 },

        { key: 'diagnostico', kind: 'area', page: 1, x: 72, y: 739, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 30 },
        { key: 'tratamiento_recomendado', kind: 'area', page: 1, x: 72, y: 691, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 30 },
        { key: 'evolucion', kind: 'area', page: 1, x: 72, y: 644, maxWidth: 460, fontSize: 9.5, lineHeight: 10.5, maxLines: 2, clearHeight: 30 },
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

function splitPatientName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' '),
    };
}

function fieldValue(key: string, input: PatientDocumentPdfInput): string {
    const patientName = normalizeText(input.patientName ?? '');
    const { firstName, lastName } = splitPatientName(patientName);

    if (key === '__patient_name') {
        return patientName;
    }
    if (key === '__patient_first_name') {
        return firstName;
    }
    if (key === '__patient_last_name') {
        return lastName;
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

        const value = fieldValue(placement.key, input);
        if (!value && !placement.alwaysDraw) continue;

        const text = fitText(`${placement.prefix ?? ''}${value}`, placement, font);
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
