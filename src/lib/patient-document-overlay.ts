/**
 * Renderer "overlay" para PDFs clínico-legales del paciente.
 *
 * En lugar de rellenar los AcroForm fields del template (cuyo appearance lo
 * decide pdf-lib y a veces deja el dato desalineado respecto del texto legal),
 * usamos el template como fondo intacto y dibujamos cada dato encima con
 * `page.drawText()` en coordenadas calibradas a partir del propio widget rect.
 *
 * Esto da control 100% sobre la posición, elimina cualquier interacción con
 * `form.flatten()` / `updateFieldAppearances` para el dato visible, y permite
 * ajustar pixel-perfect campo a campo durante la calibración.
 *
 * Sólo `clinical_history` usa este renderer por ahora. LOPD e intervención
 * seguirán por el flujo AcroForm hasta migrarlos en fases siguientes.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
    PDFDocument,
    PDFFont,
    PDFImage,
    PDFPage,
    PDFTextField,
    StandardFonts,
    rgb,
} from 'pdf-lib';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import type { SignatureBox, TemplateSpec } from '@/lib/patient-document-templates';
import { resolvePatientDocumentFieldValue, type PatientDocumentPdfInput } from '@/lib/patient-document-pdf-resolve';

// Tamaño del cuerpo legal en los templates Zeus (≈9.9pt en el original; usamos
// 9.5pt para los datos rellenados — el mismo valor que el flujo AcroForm
// anterior, así no se nota saltos de tamaño respecto del texto vecino).
const PROSE_SIZE = 9.5;
// Factor de descender de Helvetica respecto al fontSize. El build script de
// templates posicionó el widget.y a `baseline_legal - fontSize * 0.2`, así que
// recuperamos la baseline real (campos inline) sumando el mismo offset.
const DESCENDER_RATIO = 0.2;
// Factor de ascender de Helvetica respecto al fontSize. Para bloques
// multilínea la primera baseline se sitúa a `top - ascender` para que la
// primera línea quepa justo dentro del área disponible.
const ASCENDER_RATIO = 0.72;
// Separación entre líneas en bloques multilínea (proporción del fontSize).
const LINE_HEIGHT_RATIO = 1.2;
// Padding horizontal interno del widget para que el dato no toque el borde
// (los widgets son invisibles; este padding sólo afecta al cálculo de ajuste).
const PADDING_X = 1;

// Helvetica standard usa WinAnsi y no codifica flechas, em-dashes ni ciertos
// símbolos. Sustituimos chars frecuentes en historias clínicas para evitar
// crashes y mantener el texto legible.
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
    '°': 'º',
    '•': '-',
    ' ': ' ',
};

function sanitizeForWinAnsi(value: string): string {
    let out = '';
    for (const ch of value) {
        out += SANITIZE_MAP[ch] ?? ch;
    }
    return out;
}

interface FieldLayout {
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    multiline: boolean;
}

function buildLayoutMap(pdfDoc: PDFDocument): Map<string, FieldLayout[]> {
    const pages = pdfDoc.getPages();
    const form = pdfDoc.getForm();
    const map = new Map<string, FieldLayout[]>();

    for (const field of form.getFields()) {
        if (!(field instanceof PDFTextField)) continue;
        const name = field.getName();
        const multiline = field.isMultiline();
        const layouts: FieldLayout[] = [];
        for (const widget of field.acroField.getWidgets()) {
            const pageRef = widget.P();
            const pageIndex = pages.findIndex((p) => p.ref === pageRef);
            if (pageIndex === -1) continue;
            const { x, y, width, height } = widget.getRectangle();
            layouts.push({ pageIndex, x, y, width, height, multiline });
        }
        if (layouts.length > 0) map.set(name, layouts);
    }
    return map;
}

function fitInlineSize(font: PDFFont, value: string, maxWidth: number): number {
    let size = PROSE_SIZE;
    while (size > 5 && font.widthOfTextAtSize(value, size) > maxWidth) {
        size -= 0.25;
    }
    return size;
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
                // Palabra individualmente más larga que el ancho disponible
                // (DNI con guiones largos, URLs, etc.): cortamos por chars.
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

function drawInline(
    page: PDFPage,
    font: PDFFont,
    layout: FieldLayout,
    value: string
): void {
    const maxWidth = Math.max(0, layout.width - PADDING_X * 2);
    const size = fitInlineSize(font, value, maxWidth);
    const baseline = layout.y + size * DESCENDER_RATIO;
    page.drawText(value, {
        x: layout.x + PADDING_X,
        y: baseline,
        size,
        font,
    });
}

function drawBlock(
    page: PDFPage,
    font: PDFFont,
    layout: FieldLayout,
    value: string
): void {
    const maxWidth = Math.max(0, layout.width - PADDING_X * 2);
    const size = PROSE_SIZE;
    const lineHeight = size * LINE_HEIGHT_RATIO;
    const lines = wrapText(font, value, maxWidth, size);
    if (lines.length === 0) return;
    // El widget rect de un bloque cubre toda la zona disponible (desde justo
    // debajo del heading hasta encima del siguiente). La primera baseline va a
    // `top - ascender` para que la primera línea entre justo dentro del área;
    // las siguientes descienden por lineHeight.
    const top = layout.y + layout.height;
    let baseline = top - size * ASCENDER_RATIO;
    for (const line of lines) {
        if (line) {
            page.drawText(line, {
                x: layout.x + PADDING_X,
                y: baseline,
                size,
                font,
            });
        }
        baseline -= lineHeight;
    }
}

export async function renderPatientDocumentPdfOverlay(
    spec: TemplateSpec,
    input: PatientDocumentPdfInput
): Promise<Uint8Array> {
    const templateFile = PATIENT_DOCUMENT_DEFINITIONS[input.documentType].templateFileName;
    const templatePath = path.join(process.cwd(), 'public', 'consentimientos', templateFile);
    const pdfDoc = await PDFDocument.load(await readFile(templatePath));
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const layoutMap = buildLayoutMap(pdfDoc);

    // Vaciar y bloquear los AcroForm fields para que no se vean por debajo del
    // overlay (si el viewer pintase un valor previo, taparía nuestro dibujo).
    const form = pdfDoc.getForm();
    for (const field of form.getFields()) {
        if (!(field instanceof PDFTextField)) continue;
        field.setText('');
        field.enableReadOnly();
    }

    for (const [fieldName, layouts] of layoutMap.entries()) {
        const rawValue = resolvePatientDocumentFieldValue(fieldName, spec, input);
        if (!rawValue) continue;
        const value = sanitizeForWinAnsi(rawValue);
        for (const layout of layouts) {
            const page = pages[layout.pageIndex];
            if (!page) continue;
            if (layout.multiline) {
                drawBlock(page, helv, layout, value);
            } else {
                drawInline(page, helv, layout, value);
            }
        }
    }

    // Repintar appearances vacías para que los widgets invisibles no muestren
    // basura en viewers estrictos.
    form.updateFieldAppearances(helv);

    // Embeber firmas (PNG base64 capturadas por SignaturePad) en cajas
    // punteadas. Cada box mapea a `signature_firmante` o `signature_tutor`.
    await embedSignatures(pdfDoc, pages, spec.signatureBoxes ?? [], input);

    return pdfDoc.save();
}

async function embedSignatures(
    pdfDoc: PDFDocument,
    pages: PDFPage[],
    boxes: SignatureBox[],
    input: PatientDocumentPdfInput
): Promise<void> {
    for (const box of boxes) {
        const page = pages[box.page];
        if (!page) continue;
        // Tapar firma residual del PDF muestra (path vectorial escaneado de
        // Alba/Aarón embebido en el original) con rectángulo blanco. Padding
        // interior 3pt para no comer el borde dashed de la caja. Siempre se
        // aplica — si admin no firma vía canvas, caja queda en blanco.
        page.drawRectangle({
            x: box.x + 3,
            y: box.y + 3,
            width: box.width - 6,
            height: box.height - 6,
            color: rgb(1, 1, 1),
            borderWidth: 0,
        });

        const key = box.source === 'firmante' ? 'signature_firmante' : 'signature_tutor';
        const raw = input.formData[key];
        if (typeof raw !== 'string' || !raw.startsWith('data:image/png;base64,')) continue;
        const base64 = raw.slice('data:image/png;base64,'.length);
        let image: PDFImage;
        try {
            image = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
        } catch {
            // Imagen corrupta o no PNG válido — skip silenciosamente.
            continue;
        }
        // Escalar manteniendo aspect ratio dentro de la caja.
        const imgRatio = image.width / image.height;
        const boxRatio = box.width / box.height;
        let drawW: number;
        let drawH: number;
        if (imgRatio > boxRatio) {
            drawW = box.width;
            drawH = box.width / imgRatio;
        } else {
            drawH = box.height;
            drawW = box.height * imgRatio;
        }
        const x = box.x + (box.width - drawW) / 2;
        const y = box.y + (box.height - drawH) / 2;
        page.drawImage(image, { x, y, width: drawW, height: drawH });
    }
}
