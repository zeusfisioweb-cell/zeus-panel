/**
 * Render de PDFs clínico-legales del paciente.
 *
 * Todos los `documentType` usan el renderer overlay: el template se carga
 * como fondo intacto y los datos se dibujan con `page.drawText` en
 * coordenadas calibradas (baseline = baseline de la prosa legal). El widget
 * AcroForm subyacente se mantiene vacío y bloqueado (read-only) para que no
 * estorbe ni sea editable en el viewer.
 *
 * Razón de NO usar `form.flatten()` (bug histórico: corrupción de xref →
 * campos en blanco en páginas bajas) y otros detalles arquitectónicos en
 * `docs/patient-document-pdf.md`.
 */
import { renderHistoriaClinicaDynamic } from '@/lib/patient-document-historia-dynamic';
import { renderPatientDocumentPdfOverlay } from '@/lib/patient-document-overlay';
import type { PatientDocumentPdfInput } from '@/lib/patient-document-pdf-resolve';
import { PATIENT_DOCUMENT_TEMPLATES } from '@/lib/patient-document-templates';

export type { PatientDocumentPdfInput } from '@/lib/patient-document-pdf-resolve';

export async function renderPatientDocumentPdf(
    input: PatientDocumentPdfInput
): Promise<Uint8Array> {
    // Historia clínica se genera entera por código (paginación dinámica según
    // longitud del contenido). LOPD/intervención mantienen el flujo overlay
    // sobre template legal.
    if (input.documentType === 'clinical_history') {
        return renderHistoriaClinicaDynamic(input);
    }
    const spec = PATIENT_DOCUMENT_TEMPLATES[input.documentType];
    if (!spec) {
        throw new Error(`No template configured for document type ${input.documentType}`);
    }
    return renderPatientDocumentPdfOverlay(spec, input);
}
