import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderPatientDocumentPdf } from './patient-document-pdf';

const BASE = {
    patientName: 'Paciente de Prueba',
    patientDocumentId: '12345678Z',
    visitDate: '2026-05-10',
    clinicName: 'Zeus Fisioterapia',
    clinicAddress: 'Calle Mayor 1, 45500 Torrijos',
    formData: {
        edad: '38',
        sexo: 'Mujer',
        ocupacion: 'Administrativa',
        motivo_consulta: 'Dolor de cuello',
        fecha_consentimiento: '2026-05-10',
        nombre_firmante: 'Paciente de Prueba',
        dni_firmante: '12345678Z',
        nombre_tutor: 'Tutor Opcional',
        dni_tutor: 'X1234567L',
        nombre_fisioterapeuta: 'Jorge Munoz',
        num_colegiado: 'CLM-1234',
    },
};

describe('renderPatientDocumentPdf', () => {
    it('renders consent templates (overlay) preserving the original legal PDF pages', async () => {
        const cases = [
            { type: 'data_consent' as const, expectedPages: 2 },
            { type: 'intervention_consent' as const, expectedPages: 6 },
        ];

        for (const testCase of cases) {
            const bytes = await renderPatientDocumentPdf({
                documentType: testCase.type,
                ...BASE,
            });

            const pdf = await PDFDocument.load(bytes);
            expect(pdf.getPageCount()).toBe(testCase.expectedPages);
            // AcroForm fields survive (read-only, valor sobre-pintado por
            // overlay). NO `form.flatten()` (corrupción de xref histórica).
            const fields = pdf.getForm().getFields();
            expect(fields.length).toBeGreaterThan(0);
            expect(fields.every((f) => f.isReadOnly())).toBe(true);
            expect(bytes.byteLength).toBeGreaterThan(1000);
        }
    });

    it('renders the clinical history dynamically (page count depends on content)', async () => {
        const bytes = await renderPatientDocumentPdf({
            documentType: 'clinical_history',
            ...BASE,
        });
        const pdf = await PDFDocument.load(bytes);
        expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
        expect(bytes.byteLength).toBeGreaterThan(1000);
    });

    it('throws for an unconfigured document type', async () => {
        await expect(
            renderPatientDocumentPdf({
                // @ts-expect-error intentionally invalid document type
                documentType: 'unknown_type',
                ...BASE,
            })
        ).rejects.toThrow(/No template configured/);
    });
});
