/**
 * Renderer dinámico de la Historia Clínica Fisioterapéutica.
 *
 * Construye el PDF entero per-paciente con el layout "bullets + headings"
 * (refresh 2026-05): título, línea fecha plain, secciones con H1 y bullets
 * verticales o párrafos de texto libre. Sin plantilla — la única fuente
 * tipográfica es Helvetica (regular + bold) embebida en runtime.
 *
 * Layout (orden y tipos):
 *   TITLE
 *   En {ciudad} el {dia} de {mes} de {año}
 *   H1 Datos del Paciente
 *     • Nombre / Apellidos / Edad / Sexo / Ocupación
 *   H1 Motivo de la consulta
 *     <texto libre>
 *   H1 Antecedentes
 *     • Antecedentes personales:
 *       <texto libre>
 *     • Historial familiar:
 *       <texto libre>
 *   H1 Sintomatología presentada por el paciente
 *     <texto libre>
 *   H1 Exploración física en la historia clínica en fisioterapia
 *     • Peso / Altura / Tipo / Frecuencia de ejercicio físico
 *     • Efectos de la lesión sobre la capacidad del paciente...
 *       <texto libre>
 *     • Descripción de los síntomas de la dolencia...
 *       <texto libre>
 *     • Valoración de la movilidad
 *       <texto libre>
 *   H1 Pruebas diagnósticas
 *   H1 Diagnóstico del problema presentado por el paciente
 *   H1 Tratamiento recomendado
 *   H1 Evolución del paciente tras el tratamiento
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
const MARGIN_T = 60;
const MARGIN_B = 50;
const MARGIN_L = 60;
const MARGIN_R = 60;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const CONTENT_BOTTOM = MARGIN_B;
const CONTENT_TOP = PAGE_H - MARGIN_T;

const TITLE_SIZE = 16;
const H1_SIZE = 13;
const BODY_SIZE = 10;

const BULLET_INDENT = 18;
const LINE_HEIGHT = BODY_SIZE * 1.35;
const PARA_GAP = 4;
const HEADING_GAP_BEFORE = 14;
const HEADING_GAP_AFTER = 8;
const TITLE_GAP_AFTER = 14;
const FECHA_GAP_AFTER = 18;

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

function resolvePatientName(
    input: PatientDocumentPdfInput,
    part: 'first' | 'rest'
): string {
    const name = normalizeText(input.patientName ?? '');
    const parts = name.split(/\s+/).filter(Boolean);
    if (part === 'first') return parts[0] ?? '';
    return parts.slice(1).join(' ');
}

function resolveFechaLine(input: PatientDocumentPdfInput): string {
    const fromForm =
        typeof input.formData.fecha_consentimiento === 'string'
            ? input.formData.fecha_consentimiento
            : null;
    const iso = fromForm ?? input.visitDate ?? null;
    const { day, month, year } = dateParts(iso);
    const city = cityFromAddress(input.clinicAddress).split(',')[0].trim();
    return `En ${city} el ${day} de ${month} de ${year}`;
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
        if (this.pages.length > 1) {
            // Running header repeating en cada página ≥2 (como el PDF muestra).
            const header = 'Historia clínica fisioterapeutica';
            this.page.drawText(sanitize(header), {
                x: MARGIN_L,
                y: PAGE_H - 32,
                size: 7.5,
                font: this.helv,
                color: rgb(0.45, 0.45, 0.45),
            });
        }
    }

    private ensureSpace(needed: number): void {
        if (this.cursorY - needed < CONTENT_BOTTOM) {
            this.addPage();
        }
    }

    drawTitle(text: string): void {
        this.ensureSpace(TITLE_SIZE + TITLE_GAP_AFTER);
        this.page.drawText(sanitize(text), {
            x: MARGIN_L,
            y: this.cursorY - TITLE_SIZE,
            size: TITLE_SIZE,
            font: this.helvBold,
        });
        this.cursorY -= TITLE_SIZE + TITLE_GAP_AFTER;
    }

    drawFechaLine(text: string): void {
        this.ensureSpace(BODY_SIZE + FECHA_GAP_AFTER);
        this.page.drawText(sanitize(text), {
            x: MARGIN_L,
            y: this.cursorY - BODY_SIZE,
            size: BODY_SIZE,
            font: this.helv,
        });
        this.cursorY -= BODY_SIZE + FECHA_GAP_AFTER;
    }

    drawHeading(text: string): void {
        this.cursorY -= HEADING_GAP_BEFORE;
        this.ensureSpace(H1_SIZE + HEADING_GAP_AFTER);
        this.page.drawText(sanitize(text), {
            x: MARGIN_L,
            y: this.cursorY - H1_SIZE,
            size: H1_SIZE,
            font: this.helvBold,
        });
        this.cursorY -= H1_SIZE + HEADING_GAP_AFTER;
    }

    private drawBulletGlyph(x: number, baselineY: number): void {
        // Pequeño círculo lleno como bullet a la izquierda de la línea.
        this.page.drawCircle({
            x,
            y: baselineY + BODY_SIZE * 0.32,
            size: 1.5,
            color: rgb(0.2, 0.2, 0.2),
        });
    }

    /**
     * Bullet con label en bold y valor en regular en la misma línea:
     *   • Nombre: Alba
     * Si `value` está vacío sólo pinta la etiqueta.
     */
    drawBulletInline(label: string, value: string, indent = 0): void {
        const x = MARGIN_L + indent;
        const labelText = label.endsWith(':') ? label : `${label}:`;
        const labelW = this.helvBold.widthOfTextAtSize(labelText, BODY_SIZE);
        // Gap visual entre `:` y valor (wrapText elimina espacios al inicio).
        const labelValueGap = BODY_SIZE * 0.35;
        const valueStartX = x + BULLET_INDENT + labelW + labelValueGap;
        const maxValueW = CONTENT_W - indent - BULLET_INDENT - labelW - labelValueGap;
        const wrappedValue = value
            ? wrapText(this.helv, sanitize(value), maxValueW, BODY_SIZE)
            : [];

        this.ensureSpace(LINE_HEIGHT);
        const baselineY = this.cursorY - BODY_SIZE;
        this.drawBulletGlyph(x, baselineY);
        this.page.drawText(sanitize(labelText), {
            x: x + BULLET_INDENT,
            y: baselineY,
            size: BODY_SIZE,
            font: this.helvBold,
        });

        if (wrappedValue.length > 0) {
            this.page.drawText(wrappedValue[0], {
                x: valueStartX,
                y: baselineY,
                size: BODY_SIZE,
                font: this.helv,
            });
            this.cursorY -= LINE_HEIGHT;
            // Líneas adicionales del valor caen alineadas con el inicio del valor.
            for (let i = 1; i < wrappedValue.length; i++) {
                this.ensureSpace(LINE_HEIGHT);
                this.page.drawText(wrappedValue[i], {
                    x: valueStartX,
                    y: this.cursorY - BODY_SIZE,
                    size: BODY_SIZE,
                    font: this.helv,
                });
                this.cursorY -= LINE_HEIGHT;
            }
        } else {
            this.cursorY -= LINE_HEIGHT;
        }
    }

    /**
     * Bullet con solo label (negrita), valor en la línea siguiente como
     * párrafo justificado dentro del bullet. El label se envuelve si excede
     * el ancho disponible.
     */
    drawBulletBlock(label: string, value: string, indent = 0): void {
        const x = MARGIN_L + indent;
        const labelText = label.endsWith(':') ? label : `${label}:`;
        const labelMaxWidth = CONTENT_W - indent - BULLET_INDENT;
        const labelLines = wrapText(this.helvBold, sanitize(labelText), labelMaxWidth, BODY_SIZE);

        labelLines.forEach((line, idx) => {
            this.ensureSpace(LINE_HEIGHT);
            const baselineY = this.cursorY - BODY_SIZE;
            if (idx === 0) this.drawBulletGlyph(x, baselineY);
            this.page.drawText(line, {
                x: x + BULLET_INDENT,
                y: baselineY,
                size: BODY_SIZE,
                font: this.helvBold,
            });
            this.cursorY -= LINE_HEIGHT;
        });

        if (value.trim()) {
            this.drawParagraph(value, indent + BULLET_INDENT);
        }
        this.cursorY -= PARA_GAP;
    }

    /**
     * Párrafo de texto libre con sangría opcional.
     */
    drawParagraph(value: string, indent = 0): void {
        const maxWidth = CONTENT_W - indent;
        const lines = wrapText(this.helv, sanitize(value), maxWidth, BODY_SIZE);
        for (const line of lines) {
            this.ensureSpace(LINE_HEIGHT);
            if (line) {
                this.page.drawText(line, {
                    x: MARGIN_L + indent,
                    y: this.cursorY - BODY_SIZE,
                    size: BODY_SIZE,
                    font: this.helv,
                });
            }
            this.cursorY -= LINE_HEIGHT;
        }
        this.cursorY -= PARA_GAP;
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
    const f = (key: string): string => normalizeText(input.formData[key]);

    b.drawTitle('HISTORIA CLÍNICA FISIOTERAPEUTICA');
    b.drawFechaLine(resolveFechaLine(input));

    b.drawHeading('Datos del Paciente');
    b.drawBulletInline('Nombre', resolvePatientName(input, 'first'));
    b.drawBulletInline('Apellidos', resolvePatientName(input, 'rest'));
    b.drawBulletInline('Edad', f('edad'));
    b.drawBulletInline('Sexo', f('sexo'));
    b.drawBulletInline('Ocupación', f('ocupacion'));

    b.drawHeading('Motivo de la consulta');
    b.drawParagraph(f('motivo_consulta'));

    b.drawHeading('Antecedentes');
    b.drawBulletBlock('Antecedentes personales', f('antecedentes_personales'));
    b.drawBulletBlock('Historial familiar', f('historial_familiar'));

    b.drawHeading('Sintomatología presentada por el paciente');
    b.drawParagraph(f('sintomatologia'));

    b.drawHeading('Exploración física en la historia clínica en fisioterapia');
    b.drawBulletInline('Peso', f('peso'));
    b.drawBulletInline('Altura', f('altura'));
    b.drawBulletInline('Tipo', f('tipo'));
    b.drawBulletInline('Frecuencia de ejercicio físico', f('frecuencia_ejercicio'));
    b.drawBulletBlock(
        'Efectos de la lesión sobre la capacidad del paciente para realizar sus actividades profesionales y sociales',
        f('efectos_lesion')
    );
    b.drawBulletBlock(
        'Descripción de los síntomas de la dolencia, como dolor, sensación de hormigueo, calambres, entre otros, y las causas que los originan',
        f('descripcion_sintomas')
    );
    b.drawBulletBlock('Valoración de la movilidad', f('valoracion_movilidad'));

    b.drawHeading('Pruebas diagnósticas');
    b.drawParagraph(f('pruebas_diagnosticas'));

    b.drawHeading('Diagnóstico del problema presentado por el paciente');
    b.drawParagraph(f('diagnostico'));

    b.drawHeading('Tratamiento recomendado');
    b.drawParagraph(f('tratamiento_recomendado'));

    b.drawHeading('Evolución del paciente tras el tratamiento');
    b.drawParagraph(f('evolucion'));

    b.drawFooterPageNumbers();
    return b.save();
}

