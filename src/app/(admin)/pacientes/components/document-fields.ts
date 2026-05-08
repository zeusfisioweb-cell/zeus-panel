import type { PatientDocumentType } from '@/lib/types';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';

export type FieldType = 'text' | 'textarea' | 'date' | 'checkbox';

export interface FieldConfig {
    key: string;
    label: string;
    type: FieldType;
    placeholder?: string;
}

export const DOCUMENT_FIELDS: Record<PatientDocumentType, FieldConfig[]> = {
    clinical_history: [
        { key: 'motivo_consulta', label: 'Motivo de consulta', type: 'textarea', placeholder: 'Describe el motivo principal de consulta' },
        { key: 'antecedentes', label: 'Antecedentes relevantes', type: 'textarea' },
        { key: 'medicacion_actual', label: 'Medicación actual', type: 'textarea' },
        { key: 'alergias', label: 'Alergias', type: 'textarea' },
        { key: 'valoracion_inicial', label: 'Valoración inicial', type: 'textarea' },
        { key: 'plan_tratamiento', label: 'Plan de tratamiento', type: 'textarea' },
        { key: 'fecha_primera_visita', label: 'Fecha primera visita', type: 'date' },
        { key: 'profesional_responsable', label: 'Profesional responsable', type: 'text' },
    ],
    intervention_consent: [
        { key: 'tecnica_intervencion', label: 'Técnica/intervención', type: 'text' },
        { key: 'objetivo', label: 'Objetivo terapéutico', type: 'textarea' },
        { key: 'riesgos_explicitados', label: 'Riesgos explicados', type: 'textarea' },
        { key: 'alternativas_explicitadas', label: 'Alternativas explicadas', type: 'textarea' },
        { key: 'contraindicaciones', label: 'Contraindicaciones revisadas', type: 'textarea' },
        { key: 'fecha_consentimiento', label: 'Fecha consentimiento', type: 'date' },
        { key: 'nombre_firmante', label: 'Nombre del firmante', type: 'text' },
        { key: 'firma_recogida', label: 'Firma recogida', type: 'checkbox' },
    ],
    data_consent: [
        { key: 'responsable_tratamiento', label: 'Responsable del tratamiento', type: 'text' },
        { key: 'finalidad', label: 'Finalidad del tratamiento', type: 'textarea' },
        { key: 'base_legal', label: 'Base legal', type: 'text' },
        { key: 'cesiones_previstas', label: 'Cesiones previstas', type: 'textarea' },
        { key: 'plazo_conservacion', label: 'Plazo de conservación', type: 'text' },
        { key: 'canal_electronico_autorizado', label: 'Autoriza comunicaciones electrónicas', type: 'checkbox' },
        { key: 'fecha_consentimiento', label: 'Fecha consentimiento', type: 'date' },
        { key: 'nombre_firmante', label: 'Nombre del firmante', type: 'text' },
    ],
};

export const DOCUMENT_TYPE_OPTIONS = (Object.keys(DOCUMENT_FIELDS) as PatientDocumentType[]).map(
    (type) => ({ value: type, label: PATIENT_DOCUMENT_TYPE_LABELS[type] })
);

export function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export interface PrintDocumentParams {
    typeLabel: string;
    subjectLine: string;
    statusLabel: string;
    fields: FieldConfig[];
    formData: Record<string, unknown>;
    notes: string;
    templateUrl?: string;
}

export function printDocument({
    typeLabel,
    subjectLine,
    statusLabel,
    fields,
    formData,
    notes,
    templateUrl,
}: PrintDocumentParams): void {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
    if (!printWindow) return;

    const rows = fields
        .map((field) => {
            const rawValue = formData[field.key];
            const formatted = field.type === 'checkbox'
                ? rawValue ? 'Sí' : 'No'
                : String(rawValue ?? '—');
            return `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(formatted)}</td></tr>`;
        })
        .join('');

    const templateLine = templateUrl
        ? `<p class="meta"><strong>Plantilla base:</strong> ${escapeHtml(templateUrl)}</p>`
        : '';

    printWindow.document.write(`
        <html lang="es">
        <head>
          <title>${escapeHtml(typeLabel)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin-bottom: 8px; }
            .meta { color: #444; margin-bottom: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; text-align: left; vertical-align: top; padding: 8px; }
            th { width: 35%; background: #f6f6f6; }
            .notes { margin-top: 18px; padding: 12px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(typeLabel)}</h1>
          <p class="meta"><strong>${escapeHtml(subjectLine)}</strong> · <strong>Estado:</strong> ${escapeHtml(statusLabel)}</p>
          <table><tbody>${rows}</tbody></table>
          <div class="notes"><strong>Notas:</strong><br>${escapeHtml(notes || '—')}</div>
          ${templateLine}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}
