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
    minFontSize: number;
    lineHeight: number;
    maxLines: number;
}

export interface PatientDocumentPdfInput {
    documentType: PatientDocumentType;
    patientName?: string | null;
    patientDocumentId?: string | null;
    visitDate?: string | null;
    formData: Record<string, unknown>;
}

const MM = 72 / 25.4;
const PAGE_WIDTH = 595.2756;
const PAGE_HEIGHT = 841.8898;
const MARGIN_X = 16 * MM;
const MARGIN_TOP = 16 * MM;
const HEADER_GAP = 8 * MM;
const HEADER_AFTER_LINE = 7 * MM;
const SECTION_TITLE_GAP = 2.5 * MM;
const SECTION_AFTER_LINE = 4.5 * MM;
const FIELD_LABEL_GAP = 2.5 * MM;
const FIELD_AFTER_LINE = 5.5 * MM;
const AREA_HEIGHT = 16 * MM;
const AREA_AFTER = 4 * MM;
const PAGE_BREAK_THRESHOLD = 55 * MM;
const LINE_TEXT_OFFSET_Y = -4;
const AREA_TEXT_TOP_PADDING = 12;
const HORIZONTAL_TEXT_PADDING = 6;

function headerStartY(): number {
    const y = PAGE_HEIGHT - MARGIN_TOP - HEADER_GAP - HEADER_GAP;
    return y - HEADER_AFTER_LINE;
}

function advanceSectionTitle(y: number): number {
    return y - SECTION_TITLE_GAP - SECTION_AFTER_LINE;
}

function placeLineField(
    placements: FieldPlacement[],
    key: string,
    page: number,
    y: number
): number {
    const lineY = y - FIELD_LABEL_GAP;
    placements.push({
        key,
        kind: 'line',
        page,
        x: MARGIN_X + HORIZONTAL_TEXT_PADDING,
        y: lineY + LINE_TEXT_OFFSET_Y,
        maxWidth: PAGE_WIDTH - (2 * MARGIN_X) - (2 * HORIZONTAL_TEXT_PADDING),
        fontSize: 7,
        minFontSize: 6,
        lineHeight: 8,
        maxLines: 1,
    });
    return lineY - FIELD_AFTER_LINE;
}

function placeAreaField(
    placements: FieldPlacement[],
    key: string,
    page: number,
    y: number
): number {
    const boxTop = y - FIELD_LABEL_GAP;
    placements.push({
        key,
        kind: 'area',
        page,
        x: MARGIN_X + HORIZONTAL_TEXT_PADDING,
        y: boxTop - AREA_TEXT_TOP_PADDING,
        maxWidth: PAGE_WIDTH - (2 * MARGIN_X) - (2 * HORIZONTAL_TEXT_PADDING),
        fontSize: 8.8,
        minFontSize: 7,
        lineHeight: 10.2,
        maxLines: 4,
    });
    return boxTop - AREA_HEIGHT - AREA_AFTER;
}

function clinicalHistoryLayout(): FieldPlacement[] {
    const placements: FieldPlacement[] = [];
    let page = 0;
    let y = advanceSectionTitle(headerStartY());

    for (const key of [
        '__patient_name',
        'edad',
        'sexo',
        'ocupacion',
        '__visit_date',
        'profesional_responsable',
    ]) {
        y = placeLineField(placements, key, page, y);
    }

    y = advanceSectionTitle(y);

    for (const key of [
        'motivo_consulta',
        'antecedentes_personales',
        'historial_familiar',
        'sintomatologia',
    ]) {
        y = placeAreaField(placements, key, page, y);
        if (y < PAGE_BREAK_THRESHOLD) {
            page += 1;
            y = headerStartY();
        }
    }

    for (const key of ['peso', 'altura', 'tipo', 'frecuencia_ejercicio']) {
        y = placeLineField(placements, key, page, y);
    }

    for (const key of [
        'efectos_lesion',
        'descripcion_sintomas',
        'valoracion_movilidad',
        'pruebas_diagnosticas',
        'diagnostico',
        'tratamiento_recomendado',
        'evolucion',
    ]) {
        if (y < PAGE_BREAK_THRESHOLD) {
            page += 1;
            y = headerStartY();
        }
        y = placeAreaField(placements, key, page, y);
    }

    return placements;
}

function interventionConsentLayout(): FieldPlacement[] {
    const placements: FieldPlacement[] = [];
    let page = 0;
    let y = advanceSectionTitle(headerStartY());

    for (const key of [
        '__patient_name',
        '__patient_document_id',
        'fecha_consentimiento',
        'nombre_firmante',
        'dni_firmante',
        'nombre_tutor',
        'dni_tutor',
    ]) {
        y = placeLineField(placements, key, page, y);
    }

    y = advanceSectionTitle(y);

    y = placeLineField(placements, 'tecnica_intervencion', page, y);
    for (const key of [
        'objetivo',
        'riesgos_explicitados',
        'alternativas_explicitadas',
        'contraindicaciones',
    ]) {
        y = placeAreaField(placements, key, page, y);
        if (y < PAGE_BREAK_THRESHOLD) {
            page += 1;
            y = headerStartY();
        }
    }
    y = placeLineField(placements, 'firma_recogida', page, y);

    return placements;
}

function dataConsentLayout(): FieldPlacement[] {
    const placements: FieldPlacement[] = [];
    const page = 0;
    let y = advanceSectionTitle(headerStartY());

    for (const key of [
        '__patient_name',
        '__patient_document_id',
        'fecha_consentimiento',
        'nombre_firmante',
        'dni_firmante',
        'nombre_tutor',
        'dni_tutor',
    ]) {
        y = placeLineField(placements, key, page, y);
    }

    y = advanceSectionTitle(y);

    y = placeLineField(placements, 'responsable_tratamiento', page, y);
    y = placeAreaField(placements, 'finalidad', page, y);
    y = placeLineField(placements, 'base_legal', page, y);
    y = placeAreaField(placements, 'cesiones_previstas', page, y);
    y = placeLineField(placements, 'plazo_conservacion', page, y);
    placeLineField(placements, 'canal_electronico_autorizado', page, y);

    return placements;
}

function getLayout(documentType: PatientDocumentType): FieldPlacement[] {
    if (documentType === 'clinical_history') return clinicalHistoryLayout();
    if (documentType === 'intervention_consent') return interventionConsentLayout();
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
    const patientName = normalizeText(input.patientName ?? '');

    if (key === '__patient_name') {
        return patientName;
    }
    if (key === '__patient_document_id') {
        return normalizeText(input.patientDocumentId ?? '');
    }
    if (key === '__visit_date') {
        return toDateEs(normalizeText(input.visitDate ?? ''));
    }

    const raw = normalizeText(input.formData[key]);
    if (!raw) return '';
    if (key.startsWith('fecha_')) {
        return toDateEs(raw);
    }
    return raw;
}

function wrapLines(
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number,
    maxLines: number
): { lines: string[]; truncated: boolean } {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return { lines: [], truncated: false };

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
        return { lines: lines.slice(0, maxLines), truncated: true };
    }

    let truncated = false;
    if (lines.length === maxLines && consumed < words.length) {
        const last = lines[maxLines - 1] ?? '';
        let cut = last;
        while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, fontSize) > maxWidth) {
            cut = cut.slice(0, -1);
        }
        lines[maxLines - 1] = `${cut}...`;
        truncated = true;
    }

    return { lines, truncated };
}

function fitText(
    text: string,
    placement: FieldPlacement,
    font: PDFFont
): { text: string; fontSize: number; lineHeight: number } {
    for (let fontSize = placement.fontSize; fontSize >= placement.minFontSize; fontSize -= 0.5) {
        const { lines, truncated } = wrapLines(text, font, fontSize, placement.maxWidth, placement.maxLines);
        if (lines.length === 0) {
            return { text: '', fontSize, lineHeight: placement.lineHeight };
        }
        if (!truncated) {
            return {
                text: lines.join('\n'),
                fontSize,
                lineHeight: placement.lineHeight * (fontSize / placement.fontSize),
            };
        }
    }

    const { lines } = wrapLines(text, font, placement.minFontSize, placement.maxWidth, placement.maxLines);
    return {
        text: lines.join('\n'),
        fontSize: placement.minFontSize,
        lineHeight: placement.lineHeight * (placement.minFontSize / placement.fontSize),
    };
}

function firstLineWidth(text: string, font: PDFFont, fontSize: number): number {
    const firstLine = text.split('\n')[0] ?? '';
    return font.widthOfTextAtSize(firstLine, fontSize);
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

        const fitted = fitText(value, placement, font);
        if (!fitted.text) continue;

        if (placement.kind === 'line') {
            const lineY = placement.y - LINE_TEXT_OFFSET_Y;
            const lineWidth = Math.min(
                firstLineWidth(fitted.text, font, fitted.fontSize) + 8,
                placement.maxWidth
            );
            page.drawRectangle({
                x: MARGIN_X,
                y: lineY - 1,
                width: (placement.x - MARGIN_X) + lineWidth + 2,
                height: 2,
                color: rgb(1, 1, 1),
                borderWidth: 0,
            });
        }

        page.drawText(fitted.text, {
            x: placement.x,
            y: placement.y,
            font,
            size: fitted.fontSize,
            lineHeight: fitted.lineHeight,
            maxWidth: placement.maxWidth,
            color: rgb(0, 0, 0),
        });
    }

    return pdfDoc.save();
}
