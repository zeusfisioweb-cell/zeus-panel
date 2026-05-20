import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/types';

export interface ReceiptInput {
    receiptNumber: string;
    paidAt: string;
    amount: number;
    method: PaymentMethod;
    notes: string | null;
    patient: {
        fullName: string;
        documentId: string | null;
        address: string | null;
    };
    service: {
        name: string;
        appointmentStart: string;
    };
    clinic: {
        name: string;
        nif: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
    };
}

const PAGE_WIDTH = 595.28; // A4 portrait points
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;

const COLOR_HEADING = rgb(0.15, 0.2, 0.28);
const COLOR_BODY = rgb(0.2, 0.2, 0.22);
const COLOR_MUTED = rgb(0.45, 0.45, 0.5);
const COLOR_LINE = rgb(0.85, 0.85, 0.88);

function formatDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

function formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(amount);
}

function drawText(
    page: PDFPage,
    text: string,
    options: {
        x: number;
        y: number;
        size: number;
        font: PDFFont;
        color?: ReturnType<typeof rgb>;
    }
): void {
    page.drawText(text, {
        x: options.x,
        y: options.y,
        size: options.size,
        font: options.font,
        color: options.color ?? COLOR_BODY,
    });
}

function drawLabelValue(
    page: PDFPage,
    label: string,
    value: string,
    y: number,
    fonts: { regular: PDFFont; bold: PDFFont }
): number {
    drawText(page, label.toUpperCase(), {
        x: MARGIN_X,
        y,
        size: 8,
        font: fonts.bold,
        color: COLOR_MUTED,
    });
    drawText(page, value, {
        x: MARGIN_X,
        y: y - 14,
        size: 11,
        font: fonts.regular,
    });
    return y - 32;
}

export async function renderReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Recibo ${input.receiptNumber}`);
    pdf.setAuthor(input.clinic.name);
    pdf.setSubject('Recibo interno de cobro');

    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // ── Header ────────────────────────────────────────────────
    drawText(page, input.clinic.name, {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 70,
        size: 18,
        font: bold,
        color: COLOR_HEADING,
    });

    const headerLines: string[] = [];
    if (input.clinic.address) headerLines.push(input.clinic.address);
    if (input.clinic.nif) headerLines.push(`NIF: ${input.clinic.nif}`);
    const contact = [input.clinic.phone, input.clinic.email].filter(Boolean).join(' · ');
    if (contact) headerLines.push(contact);

    headerLines.forEach((line, i) => {
        drawText(page, line, {
            x: MARGIN_X,
            y: PAGE_HEIGHT - 90 - i * 12,
            size: 9,
            font: regular,
            color: COLOR_MUTED,
        });
    });

    // Receipt number block (right aligned)
    const receiptLabel = 'RECIBO';
    const receiptLabelWidth = bold.widthOfTextAtSize(receiptLabel, 9);
    drawText(page, receiptLabel, {
        x: PAGE_WIDTH - MARGIN_X - receiptLabelWidth,
        y: PAGE_HEIGHT - 70,
        size: 9,
        font: bold,
        color: COLOR_MUTED,
    });
    const numberWidth = bold.widthOfTextAtSize(input.receiptNumber, 14);
    drawText(page, input.receiptNumber, {
        x: PAGE_WIDTH - MARGIN_X - numberWidth,
        y: PAGE_HEIGHT - 88,
        size: 14,
        font: bold,
        color: COLOR_HEADING,
    });
    const dateLabel = `Fecha: ${formatDateTime(input.paidAt)}`;
    const dateLabelWidth = regular.widthOfTextAtSize(dateLabel, 9);
    drawText(page, dateLabel, {
        x: PAGE_WIDTH - MARGIN_X - dateLabelWidth,
        y: PAGE_HEIGHT - 104,
        size: 9,
        font: regular,
        color: COLOR_MUTED,
    });

    page.drawLine({
        start: { x: MARGIN_X, y: PAGE_HEIGHT - 145 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: PAGE_HEIGHT - 145 },
        thickness: 0.5,
        color: COLOR_LINE,
    });

    // ── Patient block ─────────────────────────────────────────
    let cursorY = PAGE_HEIGHT - 175;
    drawText(page, 'DATOS DEL PACIENTE', {
        x: MARGIN_X,
        y: cursorY,
        size: 10,
        font: bold,
        color: COLOR_HEADING,
    });
    cursorY -= 22;

    cursorY = drawLabelValue(page, 'Nombre', input.patient.fullName, cursorY, { regular, bold });
    if (input.patient.documentId) {
        cursorY = drawLabelValue(page, 'DNI/NIF', input.patient.documentId, cursorY, { regular, bold });
    }
    if (input.patient.address) {
        cursorY = drawLabelValue(page, 'Dirección', input.patient.address, cursorY, { regular, bold });
    }

    cursorY -= 8;
    page.drawLine({
        start: { x: MARGIN_X, y: cursorY },
        end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY },
        thickness: 0.5,
        color: COLOR_LINE,
    });
    cursorY -= 28;

    // ── Service / appointment block ───────────────────────────
    drawText(page, 'CONCEPTO', {
        x: MARGIN_X,
        y: cursorY,
        size: 10,
        font: bold,
        color: COLOR_HEADING,
    });
    cursorY -= 22;

    cursorY = drawLabelValue(page, 'Servicio', input.service.name, cursorY, { regular, bold });
    cursorY = drawLabelValue(
        page,
        'Fecha de la cita',
        formatDate(input.service.appointmentStart),
        cursorY,
        { regular, bold }
    );

    cursorY -= 8;
    page.drawLine({
        start: { x: MARGIN_X, y: cursorY },
        end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY },
        thickness: 0.5,
        color: COLOR_LINE,
    });
    cursorY -= 28;

    // ── Payment block ─────────────────────────────────────────
    drawText(page, 'PAGO', {
        x: MARGIN_X,
        y: cursorY,
        size: 10,
        font: bold,
        color: COLOR_HEADING,
    });
    cursorY -= 22;

    cursorY = drawLabelValue(
        page,
        'Método',
        PAYMENT_METHOD_LABELS[input.method] ?? input.method,
        cursorY,
        { regular, bold }
    );

    if (input.notes) {
        cursorY = drawLabelValue(page, 'Notas', input.notes, cursorY, { regular, bold });
    }

    // Amount highlight box
    const amountText = formatAmount(input.amount);
    const amountSize = 20;
    const amountWidth = bold.widthOfTextAtSize(amountText, amountSize);
    const boxWidth = amountWidth + 40;
    const boxHeight = 44;
    const boxX = PAGE_WIDTH - MARGIN_X - boxWidth;
    const boxY = cursorY - boxHeight + 8;

    page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0.95, 0.95, 0.97),
        borderColor: COLOR_HEADING,
        borderWidth: 0.8,
    });
    drawText(page, 'TOTAL', {
        x: boxX + 14,
        y: boxY + boxHeight - 14,
        size: 8,
        font: bold,
        color: COLOR_MUTED,
    });
    drawText(page, amountText, {
        x: boxX + 14,
        y: boxY + 12,
        size: amountSize,
        font: bold,
        color: COLOR_HEADING,
    });

    // ── Footer / legal disclaimer ─────────────────────────────
    const disclaimer = [
        'Este documento es un recibo interno emitido por la clínica.',
        'NO tiene validez como factura a efectos fiscales (Art. 6 RD 1619/2012).',
        'Si necesita una factura formal con su NIF, solicítela en recepción.',
    ];
    disclaimer.forEach((line, i) => {
        drawText(page, line, {
            x: MARGIN_X,
            y: 80 - i * 12,
            size: 8,
            font: regular,
            color: COLOR_MUTED,
        });
    });

    return pdf.save();
}
