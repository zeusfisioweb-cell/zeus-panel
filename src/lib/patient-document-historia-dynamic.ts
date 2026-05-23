/**
 * Renderer dinámico de la Historia Clínica Fisioterapéutica.
 *
 * A diferencia de LOPD/intervención (texto legal estático sobre el que
 * dibujamos los datos), aquí construimos el PDF entero per-paciente: cada
 * bloque reserva sólo el espacio que su contenido necesita + un mínimo, y
 * se pagina automáticamente cuando el cursor sale del margen inferior.
 *
 * Beneficio: pacientes con notas cortas → 1 página; pacientes con notas
 * extensas → 2-3 páginas. Sin huecos vacíos ni overlaps con headings.
 */
import {
    PDFDocument,
    PDFFont,
    PDFPage,
    StandardFonts,
    rgb,
} from 'pdf-lib';
import {
    cityFromAddress,
    dateParts,
} from '@/lib/patient-document-templates';
import type { PatientDocumentPdfInput } from '@/lib/patient-document-pdf-resolve';

// A4 portrait.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_T = 50;
const MARGIN_B = 50;
const MARGIN_L = 60;
const MARGIN_R = 60;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const CONTENT_BOTTOM = MARGIN_B;
const CONTENT_TOP = PAGE_H - MARGIN_T;

const TITLE_SIZE = 16;
const H1_SIZE = 12;
const LABEL_SIZE = 9.5;
const VALUE_SIZE = 9.5;
const LINE_H_INLINE = 14;
const LINE_H_BLOCK = VALUE_SIZE * 1.25;
const HEADING_GAP_BEFORE = 10;
const HEADING_GAP_AFTER = 4;
const BLOCK_MIN_H = 18; // 1 línea garantizada incluso si el campo está vacío
const BLOCK_PAD_BOTTOM = 6;

// Helvetica WinAnsi no codifica flechas, em-dashes, etc. Sustituimos a ASCII.
const SANITIZE_MAP: Record<string, string> = {
    '→': '->',
    '←': '<-',
    '↔': '<->',
    '⇒': '=>',
    '–': '-',
    '—': '-',
    '…': '...',
    '‘': "'",
    '’': "'",
    '“': '"',
    '”': '"',
    '•': '-',
    ' ': ' ',
};

function sanitize(value: string): string {
    let out = '';
    for (const ch of value) {
        out += SANITIZE_MAP[ch] ?? ch;
    }
    return out;
}

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'SÍ' : 'NO';
    return String(value).trim();
}

interface InlineFieldDef {
    label: string;
    formKey: string;
}

interface BlockDef {
    heading: string;
    formKey: string;
}

const INLINE_PATIENT: InlineFieldDef[] = [
    { label: 'Nombre', formKey: '__name_first' },
    { label: 'Apellidos', formKey: '__name_rest' },
    { label: 'Edad', formKey: 'edad' },
    { label: 'Sexo', formKey: 'sexo' },
    { label: 'Ocupación', formKey: 'ocupacion' },
    { label: 'Peso', formKey: 'peso' },
    { label: 'Altura', formKey: 'altura' },
    { label: 'Tipo', formKey: 'tipo' },
    { label: 'Frecuencia de ejercicio', formKey: 'frecuencia_ejercicio' },
];

const BLOCKS: BlockDef[] = [
    { heading: 'Motivo de la consulta', formKey: 'motivo_consulta' },
    { heading: 'Antecedentes personales', formKey: 'antecedentes_personales' },
    { heading: 'Historial familiar', formKey: 'historial_familiar' },
    { heading: 'Sintomatología presentada por el paciente', formKey: 'sintomatologia' },
    { heading: 'Efectos de la lesión sobre la capacidad del paciente', formKey: 'efectos_lesion' },
    { heading: 'Descripción de los síntomas de la dolencia', formKey: 'descripcion_sintomas' },
    { heading: 'Valoración de la movilidad', formKey: 'valoracion_movilidad' },
    { heading: 'Pruebas diagnósticas', formKey: 'pruebas_diagnosticas' },
    { heading: 'Diagnóstico del problema presentado por el paciente', formKey: 'diagnostico' },
    { heading: 'Tratamiento recomendado', formKey: 'tratamiento_recomendado' },
    { heading: 'Evolución del paciente tras el tratamiento', formKey: 'evolucion' },
];

function resolvePatientName(
    input: PatientDocumentPdfInput,
    part: 'first' | 'rest'
): string {
    const name = normalizeText(input.patientName ?? '');
    const parts = name.split(/\s+/).filter(Boolean);
    if (part === 'first') return parts[0] ?? '';
    return parts.slice(1).join(' ');
}

function resolveInlineValue(
    field: InlineFieldDef,
    input: PatientDocumentPdfInput
): string {
    if (field.formKey === '__name_first') return resolvePatientName(input, 'first');
    if (field.formKey === '__name_rest') return resolvePatientName(input, 'rest');
    return normalizeText(input.formData[field.formKey]);
}

function resolveFechaLine(input: PatientDocumentPdfInput): string {
    const fromForm =
        typeof input.formData.fecha_consentimiento === 'string'
            ? input.formData.fecha_consentimiento
            : null;
    const iso = fromForm ?? input.visitDate ?? null;
    const { day, month, year } = dateParts(iso);
    const city = cityFromAddress(input.clinicAddress);
    return `En ${city} el ${day} de ${month} de ${year}`;
}

function wrapText(
    font: PDFFont,
    value: string,
    maxWidth: number,
    size: number
): string[] {
    const lines: string[] = [];
    const paragraphs = value.split(/\r?\n/);
    for (const para of paragraphs) {
        if (para.trim() === '') {
            lines.push('');
            continue;
        }
        const words = para.split(/\s+/).filter(Boolean);
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
                current = candidate;
                continue;
            }
            if (current) lines.push(current);
            if (font.widthOfTextAtSize(word, size) > maxWidth) {
                let buffer = '';
                for (const ch of word) {
                    if (font.widthOfTextAtSize(buffer + ch, size) > maxWidth) {
                        lines.push(buffer);
                        buffer = ch;
                    } else {
                        buffer += ch;
                    }
                }
                current = buffer;
            } else {
                current = word;
            }
        }
        if (current) lines.push(current);
    }
    return lines;
}

class HistoriaBuilder {
    private doc!: PDFDocument;
    private helv!: PDFFont;
    private helvBold!: PDFFont;
    private page!: PDFPage;
    private cursorY = CONTENT_TOP;
    private pages: PDFPage[] = [];

    async init(): Promise<void> {
        this.doc = await PDFDocument.create();
        this.helv = await this.doc.embedFont(StandardFonts.Helvetica);
        this.helvBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
        this.addPage();
    }

    private addPage(): void {
        this.page = this.doc.addPage([PAGE_W, PAGE_H]);
        this.pages.push(this.page);
        this.cursorY = CONTENT_TOP;
    }

    private ensureSpace(needed: number): void {
        if (this.cursorY - needed < CONTENT_BOTTOM) {
            this.addPage();
        }
    }

    drawTitle(text: string): void {
        this.ensureSpace(TITLE_SIZE + 14);
        this.page.drawText(sanitize(text), {
            x: MARGIN_L,
            y: this.cursorY - TITLE_SIZE,
            size: TITLE_SIZE,
            font: this.helvBold,
        });
        this.cursorY -= TITLE_SIZE + 14;
    }

    drawHeading(text: string): void {
        this.cursorY -= HEADING_GAP_BEFORE;
        this.page.drawText(sanitize(text), {
            x: MARGIN_L,
            y: this.cursorY - H1_SIZE,
            size: H1_SIZE,
            font: this.helvBold,
        });
        this.cursorY -= H1_SIZE + HEADING_GAP_AFTER;
    }

    private drawHorizontalRule(): void {
        this.page.drawLine({
            start: { x: MARGIN_L, y: this.cursorY },
            end: { x: MARGIN_L + CONTENT_W, y: this.cursorY },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.85),
        });
        this.cursorY -= 4;
    }

    drawFechaLine(text: string): void {
        this.ensureSpace(LINE_H_INLINE + 6);
        const labelText = 'Fecha:';
        const labelW = this.helvBold.widthOfTextAtSize(labelText, LABEL_SIZE);
        const baselineY = this.cursorY - VALUE_SIZE;
        this.page.drawText(labelText, {
            x: MARGIN_L,
            y: baselineY,
            size: LABEL_SIZE,
            font: this.helvBold,
        });
        const valueX = MARGIN_L + labelW + 4;
        this.page.drawText(sanitize(text), {
            x: valueX,
            y: baselineY,
            size: VALUE_SIZE,
            font: this.helv,
        });
        this.cursorY -= LINE_H_INLINE;
        this.drawHorizontalRule();
        this.cursorY -= 2;
    }

    drawInlineRow(
        left: InlineFieldDef,
        leftValue: string,
        right: InlineFieldDef | null,
        rightValue: string
    ): void {
        this.ensureSpace(LINE_H_INLINE);
        const colW = CONTENT_W / 2;
        const baselineY = this.cursorY - VALUE_SIZE;

        const drawCol = (field: InlineFieldDef, value: string, x: number): void => {
            const labelText = `${field.label}:`;
            const labelW = this.helvBold.widthOfTextAtSize(labelText, LABEL_SIZE);
            this.page.drawText(sanitize(labelText), {
                x,
                y: baselineY,
                size: LABEL_SIZE,
                font: this.helvBold,
            });
            if (value) {
                this.page.drawText(sanitize(value), {
                    x: x + labelW + 4,
                    y: baselineY,
                    size: VALUE_SIZE,
                    font: this.helv,
                });
            }
        };

        drawCol(left, leftValue, MARGIN_L);
        if (right) drawCol(right, rightValue, MARGIN_L + colW);
        this.cursorY -= LINE_H_INLINE;
    }

    drawBlock(block: BlockDef, value: string): void {
        const maxWidth = CONTENT_W - 2;
        const lines = value ? wrapText(this.helv, sanitize(value), maxWidth, VALUE_SIZE) : [];
        const contentHeight = Math.max(BLOCK_MIN_H, lines.length * LINE_H_BLOCK);
        const totalNeeded =
            HEADING_GAP_BEFORE +
            H1_SIZE +
            HEADING_GAP_AFTER +
            contentHeight +
            BLOCK_PAD_BOTTOM;

        // Si no caben heading + 1 línea en lo que queda, salta de página.
        const minViable =
            HEADING_GAP_BEFORE + H1_SIZE + HEADING_GAP_AFTER + LINE_H_BLOCK + BLOCK_PAD_BOTTOM;
        if (this.cursorY - minViable < CONTENT_BOTTOM) {
            this.addPage();
        }

        this.drawHeading(block.heading);

        // Pintar líneas; si el cursor cae bajo margen, paginar a media frase.
        let baseline = this.cursorY - VALUE_SIZE * 0.8;
        for (const line of lines) {
            if (baseline - VALUE_SIZE * 0.4 < CONTENT_BOTTOM) {
                this.addPage();
                baseline = this.cursorY - VALUE_SIZE * 0.8;
            }
            if (line) {
                this.page.drawText(line, {
                    x: MARGIN_L + 1,
                    y: baseline,
                    size: VALUE_SIZE,
                    font: this.helv,
                });
            }
            baseline -= LINE_H_BLOCK;
            this.cursorY = baseline + VALUE_SIZE * 0.8;
        }

        if (lines.length === 0) {
            // Reservar al menos 1 línea visual incluso si está vacío.
            this.cursorY -= BLOCK_MIN_H;
        }
        this.cursorY -= BLOCK_PAD_BOTTOM;
        // Bias estético: línea horizontal tenue al pie del bloque.
        this.drawHorizontalRule();
        // Pequeño espacio para separar de la siguiente sección.
        // (HEADING_GAP_BEFORE ya añade aire antes del siguiente heading).
    }

    drawFooterPageNumbers(): void {
        const total = this.pages.length;
        for (let i = 0; i < total; i++) {
            const p = this.pages[i];
            const text = `Página ${i + 1} de ${total}`;
            const w = this.helv.widthOfTextAtSize(text, 8);
            p.drawText(text, {
                x: PAGE_W - MARGIN_R - w,
                y: MARGIN_B / 2,
                size: 8,
                font: this.helv,
                color: rgb(0.45, 0.45, 0.45),
            });
        }
    }

    async save(): Promise<Uint8Array> {
        return this.doc.save();
    }
}

export async function renderHistoriaClinicaDynamic(
    input: PatientDocumentPdfInput
): Promise<Uint8Array> {
    const b = new HistoriaBuilder();
    await b.init();
    b.drawTitle('HISTORIA CLÍNICA FISIOTERAPÉUTICA');
    b.drawFechaLine(resolveFechaLine(input));

    b.drawHeading('Datos del Paciente');

    for (let i = 0; i < INLINE_PATIENT.length; i += 2) {
        const left = INLINE_PATIENT[i];
        const right = INLINE_PATIENT[i + 1] ?? null;
        b.drawInlineRow(
            left,
            resolveInlineValue(left, input),
            right,
            right ? resolveInlineValue(right, input) : ''
        );
    }

    for (const block of BLOCKS) {
        const value = normalizeText(input.formData[block.formKey]);
        b.drawBlock(block, value);
    }

    b.drawFooterPageNumbers();
    return b.save();
}
