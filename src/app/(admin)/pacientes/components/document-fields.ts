import type { PatientDocumentType } from '@/lib/types';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';

export type FieldType = 'text' | 'textarea' | 'date' | 'checkbox' | 'professional_select';

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
        { key: 'profesional_responsable', label: 'Profesional responsable', type: 'professional_select' },
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
    documentType: PatientDocumentType;
    patientName: string;
    visitDate: string;
    formData: Record<string, unknown>;
    notes: string;
}

const PRINT_STYLES = `
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header__title { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.03em; }
  .header__meta { font-size: 9pt; color: #444; text-align: right; }
  .patient-bar { background: #f4f4f4; border: 1px solid #ccc; padding: 6px 10px; margin-bottom: 16px; font-size: 10pt; }
  .patient-bar strong { margin-right: 24px; }
  section { margin-bottom: 14px; }
  section h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #bbb; margin: 0 0 6px; padding-bottom: 2px; color: #333; }
  .field { margin-bottom: 10px; }
  .field label { display: block; font-size: 9pt; color: #555; margin-bottom: 2px; font-weight: bold; }
  .field .value { min-height: 22px; border-bottom: 1px solid #999; padding: 2px 4px; font-size: 10pt; white-space: pre-wrap; }
  .field .value--area { min-height: 52px; border: 1px solid #999; padding: 4px 6px; border-radius: 2px; }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 10pt; }
  .check-box { width: 14px; height: 14px; border: 1.5px solid #333; display: inline-block; text-align: center; line-height: 12px; font-size: 11pt; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
  .signature-box { border-top: 1px solid #333; padding-top: 4px; font-size: 9pt; color: #444; }
  .lopd-body { font-size: 10pt; line-height: 1.5; }
  .lopd-body p { margin: 0 0 8px; }
  .consent-declaration { font-size: 10pt; line-height: 1.55; border: 1px solid #ccc; padding: 10px; margin: 12px 0; background: #fafafa; }
  @media print { body { -webkit-print-color-adjust: exact; } }
`;

function val(formData: Record<string, unknown>, key: string): string {
    return String(formData[key] ?? '').trim();
}

function fieldBlock(label: string, value: string, area = false): string {
    return `<div class="field"><label>${escapeHtml(label)}</label><div class="value${area ? ' value--area' : ''}">${escapeHtml(value || ' ')}</div></div>`;
}

function checkBlock(label: string, checked: boolean): string {
    return `<div class="check-row"><span class="check-box">${checked ? '✓' : ' '}</span><span>${escapeHtml(label)}</span></div>`;
}

function buildClinicHeader(title: string, date: string): string {
    return `<div class="header">
      <div class="header__title">${escapeHtml(title)}</div>
      <div class="header__meta">Fecha: ${escapeHtml(date)}</div>
    </div>`;
}

function buildClinicalHistory(patientName: string, visitDate: string, formData: Record<string, unknown>, notes: string): string {
    return `
      ${buildClinicHeader('Historia Clínica Fisioterapéutica', visitDate)}
      <div class="patient-bar">
        <strong>Paciente: ${escapeHtml(patientName)}</strong>
        Profesional: ${escapeHtml(val(formData, 'profesional_responsable'))}
        &nbsp;|&nbsp; Primera visita: ${escapeHtml(val(formData, 'fecha_primera_visita'))}
      </div>
      <section>
        <h3>Motivo de consulta</h3>
        ${fieldBlock('Motivo principal', val(formData, 'motivo_consulta'), true)}
      </section>
      <section>
        <h3>Antecedentes y medicación</h3>
        ${fieldBlock('Antecedentes relevantes', val(formData, 'antecedentes'), true)}
        ${fieldBlock('Medicación actual', val(formData, 'medicacion_actual'), true)}
        ${fieldBlock('Alergias', val(formData, 'alergias'), true)}
      </section>
      <section>
        <h3>Valoración y plan</h3>
        ${fieldBlock('Valoración inicial', val(formData, 'valoracion_inicial'), true)}
        ${fieldBlock('Plan de tratamiento', val(formData, 'plan_tratamiento'), true)}
      </section>
      ${notes ? `<section><h3>Notas</h3>${fieldBlock('', notes, true)}</section>` : ''}
      <div class="signature-row">
        <div class="signature-box">Firma del profesional</div>
        <div class="signature-box">Firma del paciente / tutor</div>
      </div>`;
}

function buildInterventionConsent(patientName: string, visitDate: string, formData: Record<string, unknown>, notes: string): string {
    const firmaRecogida = Boolean(formData['firma_recogida']);
    return `
      ${buildClinicHeader('Consentimiento Informado de Intervención Fisioterapéutica', visitDate)}
      <div class="patient-bar">
        <strong>Paciente: ${escapeHtml(patientName)}</strong>
        &nbsp;|&nbsp; Fecha: ${escapeHtml(val(formData, 'fecha_consentimiento') || visitDate)}
      </div>
      <div class="consent-declaration lopd-body">
        <p>Yo, <strong>${escapeHtml(patientName)}</strong>, mayor de edad, manifiesto haber sido informado/a
        de manera comprensible por el profesional abajo firmante sobre la siguiente intervención:</p>
      </div>
      <section>
        <h3>Datos de la intervención</h3>
        ${fieldBlock('Técnica / Intervención', val(formData, 'tecnica_intervencion'))}
        ${fieldBlock('Objetivo terapéutico', val(formData, 'objetivo'), true)}
      </section>
      <section>
        <h3>Información facilitada</h3>
        ${fieldBlock('Riesgos explicados', val(formData, 'riesgos_explicitados'), true)}
        ${fieldBlock('Alternativas explicadas', val(formData, 'alternativas_explicitadas'), true)}
        ${fieldBlock('Contraindicaciones revisadas', val(formData, 'contraindicaciones'), true)}
      </section>
      <section>
        ${checkBlock('Firma recogida físicamente', firmaRecogida)}
        ${fieldBlock('Nombre del firmante', val(formData, 'nombre_firmante'))}
      </section>
      ${notes ? `<section><h3>Notas</h3>${fieldBlock('', notes, true)}</section>` : ''}
      <div class="signature-row">
        <div class="signature-box">Firma del profesional / centro</div>
        <div class="signature-box">Firma del paciente / representante legal</div>
      </div>`;
}

function buildDataConsent(patientName: string, visitDate: string, formData: Record<string, unknown>, notes: string): string {
    const canalAutorizado = Boolean(formData['canal_electronico_autorizado']);
    return `
      ${buildClinicHeader('Consentimiento de Protección de Datos (LOPD/RGPD)', visitDate)}
      <div class="patient-bar">
        <strong>Paciente / Titular: ${escapeHtml(patientName)}</strong>
        &nbsp;|&nbsp; Fecha: ${escapeHtml(val(formData, 'fecha_consentimiento') || visitDate)}
      </div>
      <section>
        <h3>Responsable del tratamiento</h3>
        ${fieldBlock('Responsable', val(formData, 'responsable_tratamiento'))}
        ${fieldBlock('Finalidad del tratamiento', val(formData, 'finalidad'), true)}
        ${fieldBlock('Base legal', val(formData, 'base_legal'))}
      </section>
      <section>
        <h3>Derechos y conservación</h3>
        ${fieldBlock('Cesiones previstas', val(formData, 'cesiones_previstas'), true)}
        ${fieldBlock('Plazo de conservación', val(formData, 'plazo_conservacion'))}
      </section>
      <section>
        <div class="consent-declaration lopd-body">
          <p>El titular puede ejercer los derechos de acceso, rectificación, supresión, oposición,
          portabilidad y limitación del tratamiento dirigiéndose al responsable indicado.</p>
        </div>
        ${checkBlock('Autoriza comunicaciones por canal electrónico', canalAutorizado)}
        ${fieldBlock('Nombre del firmante', val(formData, 'nombre_firmante'))}
      </section>
      ${notes ? `<section><h3>Notas</h3>${fieldBlock('', notes, true)}</section>` : ''}
      <div class="signature-row">
        <div class="signature-box">Firma del responsable / centro</div>
        <div class="signature-box">Firma del titular / representante</div>
      </div>`;
}

export function printDocument({ documentType, patientName, visitDate, formData, notes }: PrintDocumentParams): void {
    const displayDate = visitDate
        ? new Date(visitDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    let body = '';
    if (documentType === 'clinical_history') {
        body = buildClinicalHistory(patientName, displayDate, formData, notes);
    } else if (documentType === 'intervention_consent') {
        body = buildInterventionConsent(patientName, displayDate, formData, notes);
    } else {
        body = buildDataConsent(patientName, displayDate, formData, notes);
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapeHtml(PATIENT_DOCUMENT_TYPE_LABELS[documentType])}</title>
<style>${PRINT_STYLES}</style></head>
<body>${body}<script>window.addEventListener('load',function(){window.print();});<\/script></body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}
