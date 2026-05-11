import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderPatientDocumentPdf } from './patient-document-pdf';

describe('renderPatientDocumentPdf', () => {
    it('uses the sanitized template page counts for each document type', async () => {
        const cases = [
            { type: 'clinical_history' as const, expectedPages: 2 },
            { type: 'intervention_consent' as const, expectedPages: 1 },
            { type: 'data_consent' as const, expectedPages: 1 },
        ];

        for (const testCase of cases) {
            const bytes = await renderPatientDocumentPdf({
                documentType: testCase.type,
                patientName: 'Paciente de Prueba',
                patientDocumentId: '12345678Z',
                visitDate: '2026-05-10',
                formData: {
                    edad: '38',
                    sexo: 'Mujer',
                    ocupacion: 'Administrativa',
                    motivo_consulta: 'Dolor de cuello',
                    antecedentes_personales: 'Sin incidencias',
                    historial_familiar: 'Sin antecedentes relevantes',
                    sintomatologia: 'Rigidez y molestias al girar',
                    fecha_consentimiento: '2026-05-10',
                    nombre_firmante: 'Paciente de Prueba',
                    dni_firmante: '12345678Z',
                    nombre_tutor: 'Tutor opcional',
                    dni_tutor: 'X1234567L',
                },
            });

            const pdf = await PDFDocument.load(bytes);
            expect(pdf.getPageCount()).toBe(testCase.expectedPages);
            expect(bytes.byteLength).toBeGreaterThan(1000);
        }
    });
});
