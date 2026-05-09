import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, type PDFFont, rgb } from 'pdf-lib';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import type { PatientDocumentType } from '@/lib/types';

const PAGE_W = 595.2755905511812; // A4 width in pt
const PAGE_H = 841.8897637795277; // A4 height in pt
const MM_TO_PT = 72 / 25.4;

const marginX = mm(16);
const marginTop = mm(16);

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
}

interface LayoutState {
    page: number;
    y: number;
    fields: FieldPlacement[];
}

export interface PatientDocumentPdfInput {
    documentType: PatientDocumentType;
    patientName?: string | null;
    patientDocumentId?: string | null;
    visitDate?: string | null;
    formData: Record<string, unknown>;
}

function mm(value: number): number {
    return value * MM_TO_PT;
}

function startContentY(): number {
    let y = PAGE_H - marginTop;
    y -= mm(8);
    y -= mm(8);
    y -= mm(7);
    return y;
}

function sectionTitle(y: number): number {
    y -= mm(2.5);
    y -= mm(4.5);
    return y;
}

function addLineField(state: LayoutState, key: string): void {
    const lineY = state.y - mm(2.5);
    state.fields.push({
        key,
        kind: 'line',
        page: state.page,
        x: marginX + mm(2),
        y: lineY + mm(1.4),
        maxWidth: PAGE_W - (2 * marginX) - mm(4),
        fontSize: 10,
        lineHeight: 11,
        maxLines: 1,
    });
    state.y = lineY - mm(5.5);
}

function addAreaField(state: LayoutState, key: string): void {
    const rectTop = state.y - mm(2.5);
    const rectHeight = mm(16);
    state.fields.push({
        key,
        kind: 'area',
        page: state.page,
        x: marginX + mm(2),
        y: rectTop - mm(4),
        maxWidth: PAGE_W - (2 * marginX) - mm(4),
        fontSize: 9.5,
        lineHeight: 10.5,
        maxLines: 4,
    });
    state.y = rectTop - rectHeight - mm(4);
}

function newPage(state: LayoutState): void {
    state.page += 1;
    state.y = startContentY();
}

function clinicalHistoryLayout(): FieldPlacement[] {
    const state: LayoutState = { page: 0, y: startContentY(), fields: [] };
    state.y = sectionTitle(state.y);

    addLineField(state, '__patient_name');
    addLineField(state, 'edad');
    addLineField(state, 'sexo');
    addLineField(state, 'ocupacion');
    addLineField(state, 'fecha_primera_visita');
    addLineField(state, 'profesional_responsable');

    state.y = sectionTitle(state.y);
    for (const key of [
        'motivo_consulta',
        'antecedentes_personales',
        'historial_familiar',
        'sintomatologia',
    ]) {
        addAreaField(state, key);
        if (state.y < mm(55)) {
            newPage(state);
        }
    }

    addLineField(state, 'peso');
    addLineField(state, 'altura');
    addLineField(state, 'tipo');
    addLineField(state, 'frecuencia_ejercicio');

    for (const key of [
        'efectos_lesion',
        'descripcion_sintomas',
        'valoracion_movilidad',
        'pruebas_diagnosticas',
        'diagnostico',
        'tratamiento_recomendado',
        'evolucion',
    ]) {
        if (state.y < mm(55)) {
            newPage(state);
        }
        addAreaField(state, key);
    }

    return state.fields;
}

function interventionConsentLayout(): FieldPlacement[] {
    const state: LayoutState = { page: 0, y: startContentY(), fields: [] };
    state.y = sectionTitle(state.y);

    addLineField(state, '__patient_name');
    addLineField(state, '__patient_document_id');
    addLineField(state, 'fecha_consentimiento');
    addLineField(state, 'nombre_firmante');
    addLineField(state, 'dni_firmante');
    addLineField(state, 'nombre_tutor');
    addLineField(state, 'dni_tutor');

    state.y = sectionTitle(state.y);
    addLineField(state, 'tecnica_intervencion');

    for (const key of [
        'objetivo',
        'riesgos_explicitados',
        'alternativas_explicitadas',
        'contraindicaciones',
    ]) {
        addAreaField(state, key);
        if (state.y < mm(55)) {
            newPage(state);
        }
    }

    addLineField(state, 'firma_recogida');
    return state.fields;
}

function dataConsentLayout(): FieldPlacement[] {
    const state: LayoutState = { page: 0, y: startContentY(), fields: [] };
    state.y = sectionTitle(state.y);

    addLineField(state, '__patient_name');
    addLineField(state, '__patient_document_id');
    addLineField(state, 'fecha_consentimiento');
    addLineField(state, 'nombre_firmante');
    addLineField(state, 'dni_firmante');
    addLineField(state, 'nombre_tutor');
    addLineField(state, 'dni_tutor');

    state.y = sectionTitle(state.y);
    const rows: Array<{ key: string; kind: FieldKind }> = [
        { key: 'responsable_tratamiento', kind: 'line' },
        { key: 'finalidad', kind: 'area' },
        { key: 'base_legal', kind: 'line' },
        { key: 'cesiones_previstas', kind: 'area' },
        { key: 'plazo_conservacion', kind: 'line' },
        { key: 'canal_electronico_autorizado', kind: 'line' },
    ];

    for (const row of rows) {
        if (state.y < mm(55)) {
            newPage(state);
        }
        if (row.kind === 'area') {
            addAreaField(state, row.key);
        } else {
            addLineField(state, row.key);
        }
    }

    return state.fields;
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

    if (lines.length === maxLines) {
        if (consumed < words.length) {
            const last = lines[maxLines - 1] ?? '';
            let cut = last;
            while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, fontSize) > maxWidth) {
                cut = cut.slice(0, -1);
            }
            lines[maxLines - 1] = `${cut}…`;
        }
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

        const text = fitText(value, placement, font);
        if (!text) continue;

        page.drawText(text, {
            x: placement.x,
            y: placement.y,
            font,
            size: placement.fontSize,
            lineHeight: placement.lineHeight,
            maxWidth: placement.maxWidth,
            color: rgb(0.08, 0.08, 0.08),
        });
    }

    return pdfDoc.save();
}
