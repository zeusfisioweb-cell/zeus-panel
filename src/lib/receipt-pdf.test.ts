import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderReceiptPdf, type ReceiptInput } from '@/lib/receipt-pdf';

function buildInput(overrides: Partial<ReceiptInput> = {}): ReceiptInput {
    return {
        receiptNumber: 'R-2026-0001',
        paidAt: '2026-05-20T10:30:00.000Z',
        amount: 40,
        method: 'cash',
        notes: null,
        patient: {
            fullName: 'Ana Pérez García',
            documentId: '12345678Z',
            address: 'Calle Mayor 5, Madrid',
        },
        service: {
            name: 'Sesión de fisioterapia',
            appointmentStart: '2026-05-20T09:00:00.000Z',
        },
        clinic: {
            name: 'Zeus Fisioterapia',
            nif: 'B12345678',
            address: 'Av. Salud 10, Madrid',
            phone: '910000000',
            email: 'hola@zeus.com',
        },
        ...overrides,
    };
}

describe('renderReceiptPdf', () => {
    it('produces a valid PDF byte stream', async () => {
        const bytes = await renderReceiptPdf(buildInput());
        expect(bytes.length).toBeGreaterThan(1000);
        const header = Buffer.from(bytes.slice(0, 4)).toString('utf8');
        expect(header).toBe('%PDF');
    });

    it('embeds metadata derived from the receipt', async () => {
        const bytes = await renderReceiptPdf(buildInput());
        const parsed = await PDFDocument.load(bytes);
        expect(parsed.getTitle()).toBe('Recibo R-2026-0001');
        expect(parsed.getAuthor()).toBe('Zeus Fisioterapia');
    });

    it('handles missing optional patient fields without throwing', async () => {
        const bytes = await renderReceiptPdf(
            buildInput({
                patient: { fullName: 'Paciente Sin Datos', documentId: null, address: null },
            })
        );
        expect(bytes.length).toBeGreaterThan(1000);
    });

    it('renders all supported payment methods', async () => {
        const methods = ['cash', 'card', 'bizum', 'transfer', 'other'] as const;
        for (const method of methods) {
            const bytes = await renderReceiptPdf(buildInput({ method }));
            expect(bytes.length).toBeGreaterThan(1000);
        }
    });

    it('survives an amount with decimals and large value', async () => {
        const bytes = await renderReceiptPdf(buildInput({ amount: 1234.56 }));
        expect(bytes.length).toBeGreaterThan(1000);
    });

    it('renders without nif when tax id missing', async () => {
        const bytes = await renderReceiptPdf(
            buildInput({
                clinic: {
                    name: 'Zeus Fisioterapia',
                    nif: null,
                    address: 'Av. Salud 10, Madrid',
                    phone: '910000000',
                    email: 'hola@zeus.com',
                },
            })
        );
        expect(bytes.length).toBeGreaterThan(1000);
    });

    it('renders with nif when tax id present', async () => {
        const withNif = await renderReceiptPdf(buildInput());
        const withoutNif = await renderReceiptPdf(
            buildInput({
                clinic: {
                    name: 'Zeus Fisioterapia',
                    nif: null,
                    address: 'Av. Salud 10, Madrid',
                    phone: '910000000',
                    email: 'hola@zeus.com',
                },
            })
        );
        expect(withNif.length).not.toBe(withoutNif.length);
    });
});
