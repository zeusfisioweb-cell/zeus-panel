/**
 * Genera el template `historia_clinica_fisioterapeutica_template.pdf` desde
 * cero. El template original (escaneado/fotocopiado) tenía las secciones
 * tan apretadas que los datos largos desbordaban headings. Aquí construimos
 * una versión limpia con espacio generoso (mínimo 80pt por bloque) y
 * paginación dinámica.
 *
 * Layout:
 *  - Página 1: título, fecha, datos del paciente inline, primeros bloques.
 *  - Páginas siguientes: bloques restantes con headings + áreas grandes.
 *  - AcroForm fields invisibles (sin borde, sin fondo). El renderer overlay
 *    los descubre y dibuja los valores con `page.drawText()`.
 *
 *   node_modules/.bin/tsx scripts/build-historia-template.ts
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    PDFDocument,
    PDFFont,
    PDFName,
    PDFPage,
    StandardFonts,
    rgb,
} from 'pdf-lib';

const OUT_PATH = path.join(
    process.cwd(),
    'public',
    'consentimientos',
    'historia_clinica_fisioterapeutica_template.pdf'
);

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
const LINE_H = 14; // separación inline rows
const HEADING_GAP_BEFORE = 14;
const HEADING_GAP_AFTER = 4;
const BLOCK_DEFAULT_H = 80;

interface InlineField {
    label: string;
    field: string;
}

interface BlockSection {
    heading: string;
    field: string;
    minHeight: number;
}

const INLINE_PATIENT: InlineField[] = [
    { label: 'Nombre', field: 'nombre' },
    { label: 'Apellidos', field: 'apellidos' },
    { label: 'Edad', field: 'edad' },
    { label: 'Sexo', field: 'sexo' },
    { label: 'Ocupación', field: 'ocupacion' },
    { label: 'Peso', field: 'peso' },
    { label: 'Altura', field: 'altura' },
    { label: 'Tipo', field: 'tipo' },
    { label: 'Frecuencia de ejercicio', field: 'frecuencia_ejercicio' },
];

const BLOCKS: BlockSection[] = [
    { heading: 'Motivo de la consulta', field: 'motivo_consulta', minHeight: 90 },
    { heading: 'Antecedentes personales', field: 'antecedentes_personales', minHeight: 120 },
    { heading: 'Historial familiar', field: 'historial_familiar', minHeight: 90 },
    { heading: 'Sintomatología presentada por el paciente', field: 'sintomatologia', minHeight: 110 },
    { heading: 'Efectos de la lesión sobre la capacidad del paciente', field: 'efectos_lesion', minHeight: 90 },
    { heading: 'Descripción de los síntomas de la dolencia', field: 'descripcion_sintomas', minHeight: 90 },
    { heading: 'Valoración de la movilidad', field: 'valoracion_movilidad', minHeight: 90 },
    { heading: 'Pruebas diagnósticas', field: 'pruebas_diagnosticas', minHeight: 90 },
    { heading: 'Diagnóstico del problema presentado por el paciente', field: 'diagnostico', minHeight: 90 },
    { heading: 'Tratamiento recomendado', field: 'tratamiento_recomendado', minHeight: 120 },
    { heading: 'Evolución del paciente tras el tratamiento', field: 'evolucion', minHeight: 140 },
];

interface FieldRect {
    name: string;
    page: PDFPage;
    x: number;
    y: number;
    width: number;
    height: number;
    multiline: boolean;
}

class Builder {
    private doc!: PDFDocument;
    private helv!: PDFFont;
    private helvBold!: PDFFont;
    private page!: PDFPage;
    private cursorY = CONTENT_TOP;
    private fieldRects: FieldRect[] = [];

    async init(): Promise<void> {
        this.doc = await PDFDocument.create();
        this.helv = await this.doc.embedFont(StandardFonts.Helvetica);
        this.helvBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
        this.addPage();
    }

    private addPage(): void {
        this.page = this.doc.addPage([PAGE_W, PAGE_H]);
        this.cursorY = CONTENT_TOP;
    }

    private ensureSpace(needed: number): void {
        if (this.cursorY - needed < CONTENT_BOTTOM) {
            this.addPage();
        }
    }

    private drawTitle(text: string): void {
        this.ensureSpace(TITLE_SIZE + 12);
        this.page.drawText(text, {
            x: MARGIN_L,
            y: this.cursorY - TITLE_SIZE,
            size: TITLE_SIZE,
            font: this.helvBold,
            color: rgb(0, 0, 0),
        });
        this.cursorY -= TITLE_SIZE + 18;
    }

    private drawHeading(text: string): void {
        this.ensureSpace(HEADING_GAP_BEFORE + H1_SIZE + HEADING_GAP_AFTER);
        this.cursorY -= HEADING_GAP_BEFORE;
        this.page.drawText(text, {
            x: MARGIN_L,
            y: this.cursorY - H1_SIZE,
            size: H1_SIZE,
            font: this.helvBold,
        });
        this.cursorY -= H1_SIZE + HEADING_GAP_AFTER;
    }

    private addInlineFieldRect(
        name: string,
        x: number,
        baselineY: number,
        width: number
    ): void {
        // El renderer overlay calcula la baseline como `widget.y + size * 0.2`,
        // así que situamos widget.y = baseline - size * 0.2.
        const y = baselineY - VALUE_SIZE * 0.2;
        this.fieldRects.push({
            name,
            page: this.page,
            x,
            y,
            width,
            height: VALUE_SIZE * 1.3,
            multiline: false,
        });
    }

    private addBlockFieldRect(
        name: string,
        x: number,
        topY: number,
        width: number,
        height: number
    ): void {
        // Para bloques, el overlay usa `top - ascender` como primera baseline.
        // top = widget.y + widget.height. Almacenamos widget.y = topY - height.
        this.fieldRects.push({
            name,
            page: this.page,
            x,
            y: topY - height,
            width,
            height,
            multiline: true,
        });
    }

    drawDateLine(): void {
        // Una sola línea: "Fecha: __" usando el campo compuesto historia_fecha
        // que resuelve a "En [city] el [day] de [month] de [year]".
        this.ensureSpace(LINE_H + 6);
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
        this.addInlineFieldRect(
            'historia_fecha',
            valueX,
            baselineY,
            MARGIN_L + CONTENT_W - valueX
        );
        // Línea horizontal sutil debajo del valor (decorativa, indica blank).
        this.page.drawLine({
            start: { x: valueX, y: baselineY - 2 },
            end: { x: MARGIN_L + CONTENT_W, y: baselineY - 2 },
            thickness: 0.5,
            color: rgb(0.7, 0.7, 0.7),
        });
        this.cursorY -= LINE_H + 6;
    }

    drawInlineRow(left: InlineField, right: InlineField | null): void {
        this.ensureSpace(LINE_H);
        const colW = CONTENT_W / 2;
        const baselineY = this.cursorY - VALUE_SIZE;

        const drawCol = (field: InlineField, x: number): void => {
            const labelText = `${field.label}:`;
            const labelW = this.helvBold.widthOfTextAtSize(labelText, LABEL_SIZE);
            this.page.drawText(labelText, {
                x,
                y: baselineY,
                size: LABEL_SIZE,
                font: this.helvBold,
            });
            const valueX = x + labelW + 4;
            const valueW = colW - (labelW + 4) - 10;
            this.addInlineFieldRect(field.field, valueX, baselineY, valueW);
            this.page.drawLine({
                start: { x: valueX, y: baselineY - 2 },
                end: { x: valueX + valueW, y: baselineY - 2 },
                thickness: 0.5,
                color: rgb(0.7, 0.7, 0.7),
            });
        };

        drawCol(left, MARGIN_L);
        if (right) drawCol(right, MARGIN_L + colW);
        this.cursorY -= LINE_H;
    }

    drawBlock(block: BlockSection): void {
        const needed =
            HEADING_GAP_BEFORE + H1_SIZE + HEADING_GAP_AFTER + block.minHeight;
        this.ensureSpace(needed);
        this.drawHeading(block.heading);
        const blockTop = this.cursorY;
        this.addBlockFieldRect(
            block.field,
            MARGIN_L,
            blockTop,
            CONTENT_W,
            block.minHeight
        );
        // Borde inferior tenue marca el final del área editable.
        this.page.drawLine({
            start: { x: MARGIN_L, y: blockTop - block.minHeight },
            end: { x: MARGIN_L + CONTENT_W, y: blockTop - block.minHeight },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.85),
        });
        this.cursorY -= block.minHeight + 6;
    }

    drawFooterPageNumbers(): void {
        const pages = this.doc.getPages();
        for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            const text = `Página ${i + 1} de ${pages.length}`;
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

    drawTitleAndContent(): void {
        this.drawTitle('HISTORIA CLÍNICA FISIOTERAPÉUTICA');
        this.drawDateLine();
        this.drawHeading('Datos del Paciente');
        for (let i = 0; i < INLINE_PATIENT.length; i += 2) {
            this.drawInlineRow(
                INLINE_PATIENT[i],
                INLINE_PATIENT[i + 1] ?? null
            );
        }
        for (const block of BLOCKS) {
            this.drawBlock(block);
        }
    }

    async createAcroFormFields(): Promise<void> {
        const form = this.doc.getForm();
        const seen = new Set<string>();
        for (const rect of this.fieldRects) {
            let tf;
            if (seen.has(rect.name)) {
                tf = form.getTextField(rect.name);
            } else {
                tf = form.createTextField(rect.name);
                seen.add(rect.name);
            }
            if (rect.multiline) tf.enableMultiline();
            tf.addToPage(rect.page, {
                x: rect.x,
                y: rect.y,
                width: Math.max(8, rect.width),
                height: Math.max(8, rect.height),
                borderWidth: 0,
                backgroundColor: undefined,
                textColor: rgb(0, 0, 0),
                font: this.helv,
            });
            tf.enableReadOnly();
        }
        // Eliminar BorderStyle/MK para garantizar invisibilidad en todos los
        // viewers (algunos pintan caja punteada en debug).
        for (const name of seen) {
            for (const w of form.getTextField(name).acroField.getWidgets()) {
                w.dict.delete(PDFName.of('BS'));
                w.dict.delete(PDFName.of('MK'));
            }
        }
    }

    async save(): Promise<Uint8Array> {
        return this.doc.save();
    }
}

async function main(): Promise<void> {
    const b = new Builder();
    await b.init();
    b.drawTitleAndContent();
    b.drawFooterPageNumbers();
    await b.createAcroFormFields();
    const bytes = await b.save();
    await writeFile(OUT_PATH, bytes);
    process.stdout.write(`[ok] wrote ${OUT_PATH}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
});
