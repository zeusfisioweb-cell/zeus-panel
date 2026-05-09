import type { PatientDocumentType } from '@/lib/types';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';
import {
    getDocumentFields,
    PATIENT_DOCUMENT_DEFINITIONS,
    type PatientDocumentField,
    type PatientDocumentFieldType,
} from '@/lib/patient-document-definitions';

export type FieldType = PatientDocumentFieldType;
export type FieldConfig = PatientDocumentField;

export const DOCUMENT_FIELDS: Record<PatientDocumentType, FieldConfig[]> = {
    clinical_history: getDocumentFields('clinical_history'),
    intervention_consent: getDocumentFields('intervention_consent'),
    data_consent: getDocumentFields('data_consent'),
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
    documentType: PatientDocumentType;
    patientName: string;
    visitDate: string;
    formData: Record<string, unknown>;
}

const PRINT_STYLES = `
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111827;
    font-family: "Inter", "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.35;
  }
  .sheet {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 14px 14px 12px;
  }
  .head {
    border-bottom: 2px solid #111827;
    padding-bottom: 8px;
    margin-bottom: 12px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
  }
  .head__title {
    margin: 0;
    font-size: 13pt;
    line-height: 1.2;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }
  .head__meta {
    text-align: right;
    font-size: 9pt;
    color: #4b5563;
  }
  .patient {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 12px;
    background: #f9fafb;
  }
  .patient__label {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
  }
  .patient__value {
    margin-top: 2px;
    font-size: 10pt;
    font-weight: 600;
  }
  .section {
    margin-bottom: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section__title {
    margin: 0 0 7px;
    font-size: 9pt;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #374151;
    border-bottom: 1px solid #d1d5db;
    padding-bottom: 3px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 10px;
  }
  .field {
    min-height: 34px;
  }
  .field--full {
    grid-column: 1 / -1;
  }
  .field__label {
    font-size: 8.5pt;
    color: #4b5563;
    margin-bottom: 2px;
    font-weight: 600;
  }
  .field__value {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    min-height: 24px;
    padding: 5px 7px;
    font-size: 10pt;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background: #fff;
  }
  .field__value--area {
    min-height: 56px;
  }
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .checkbox__box {
    width: 14px;
    height: 14px;
    border: 1px solid #374151;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
  .sign {
    margin-top: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .sign__line {
    border-top: 1px solid #111827;
    padding-top: 4px;
    font-size: 8.5pt;
    color: #4b5563;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { border: none; border-radius: 0; padding: 0; }
  }
`;

function val(formData: Record<string, unknown>, key: string): string {
    return String(formData[key] ?? '').trim();
}

function isAreaField(field: FieldConfig): boolean {
    return field.type === 'textarea';
}

function isFullWidthField(field: FieldConfig): boolean {
    return field.type === 'textarea';
}

function renderField(field: FieldConfig, formData: Record<string, unknown>): string {
    if (field.type === 'checkbox') {
        const checked = Boolean(formData[field.key]);
        return `
          <div class="field">
            <div class="field__label">${escapeHtml(field.label)}</div>
            <div class="field__value">
              <span class="checkbox">
                <span class="checkbox__box">${checked ? '✓' : ''}</span>
                <span>${checked ? 'Sí' : 'No'}</span>
              </span>
            </div>
          </div>
        `;
    }

    const value = val(formData, field.key);
    return `
      <div class="field ${isFullWidthField(field) ? 'field--full' : ''}">
        <div class="field__label">${escapeHtml(field.label)}</div>
        <div class="field__value ${isAreaField(field) ? 'field__value--area' : ''}">
          ${escapeHtml(value || ' ')}
        </div>
      </div>
    `;
}

function renderDocumentBody(
    documentType: PatientDocumentType,
    patientName: string,
    displayDate: string,
    formData: Record<string, unknown>
): string {
    const definition = PATIENT_DOCUMENT_DEFINITIONS[documentType];

    const sections = definition.sections.map((section) => `
      <section class="section">
        <h2 class="section__title">${escapeHtml(section.title)}</h2>
        <div class="grid">
          ${section.fields.map((field) => renderField(field, formData)).join('')}
        </div>
      </section>
    `).join('');

    return `
      <div class="sheet">
        <header class="head">
          <h1 class="head__title">${escapeHtml(definition.title)}</h1>
          <div class="head__meta">Emitido: ${escapeHtml(displayDate)}</div>
        </header>

        <div class="patient">
          <div>
            <div class="patient__label">Paciente</div>
            <div class="patient__value">${escapeHtml(patientName)}</div>
          </div>
          <div>
            <div class="patient__label">Fecha del documento</div>
            <div class="patient__value">${escapeHtml(displayDate)}</div>
          </div>
        </div>

        ${sections}

        <div class="sign">
          <div class="sign__line">Firma profesional</div>
          <div class="sign__line">Firma paciente / representante legal</div>
        </div>
      </div>
    `;
}

export function printDocument({ documentType, patientName, visitDate, formData }: PrintDocumentParams): void {
    const displayDate = visitDate
        ? new Date(visitDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    const body = renderDocumentBody(documentType, patientName, displayDate, formData);
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(PATIENT_DOCUMENT_TYPE_LABELS[documentType])}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${body}
  <script>
    window.addEventListener('load', function () {
      window.print();
    });
  <\/script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=1200');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}
