'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PatientDocument, PatientDocumentType, PatientDocumentStatus } from '@/lib/types';
import { PATIENT_DOCUMENT_STATUS_LABELS, PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { readApiError } from '@/lib/api-helpers';

type FieldType = 'text' | 'textarea' | 'date' | 'checkbox';

interface FieldConfig {
    key: string;
    label: string;
    type: FieldType;
    placeholder?: string;
}

const DOCUMENT_FIELDS: Record<PatientDocumentType, FieldConfig[]> = {
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

interface PatientDocumentModalProps {
    isOpen: boolean;
    patientId: string;
    patientName: string;
    document: PatientDocument | null;
    onClose: () => void;
    onSaved: (document: PatientDocument) => void;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function PatientDocumentModal({
    isOpen,
    patientId,
    patientName,
    document,
    onClose,
    onSaved,
}: PatientDocumentModalProps) {
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [status, setStatus] = useState<PatientDocumentStatus>('draft');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!document) return;
        setFormData(document.form_data ?? {});
        setStatus(document.status);
        setNotes(document.notes ?? '');
    }, [document]);

    const fields = useMemo(
        () => (document ? DOCUMENT_FIELDS[document.document_type] : []),
        [document]
    );

    if (!document) return null;
    const currentDocument = document;

    const templateUrl = `/consentimientos/${currentDocument.template_file_name}`;

    function updateField(key: string, value: unknown) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    function handlePrint() {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
        if (!printWindow) {
            toast.error('No se pudo abrir la ventana de impresión');
            return;
        }

        const rows = fields
            .map((field) => {
                const rawValue = formData[field.key];
                const formattedValue = field.type === 'checkbox'
                    ? rawValue ? 'Sí' : 'No'
                    : String(rawValue ?? '—');
                return `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(formattedValue)}</td></tr>`;
            })
            .join('');

        printWindow.document.write(`
            <html lang="es">
            <head>
              <title>${escapeHtml(PATIENT_DOCUMENT_TYPE_LABELS[currentDocument.document_type])}</title>
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
              <h1>${escapeHtml(PATIENT_DOCUMENT_TYPE_LABELS[currentDocument.document_type])}</h1>
              <p class="meta"><strong>Paciente:</strong> ${escapeHtml(patientName)} · <strong>Estado:</strong> ${escapeHtml(PATIENT_DOCUMENT_STATUS_LABELS[status])}</p>
              <table>
                <tbody>${rows}</tbody>
              </table>
              <div class="notes"><strong>Notas:</strong><br>${escapeHtml(notes || '—')}</div>
              <p class="meta"><strong>Plantilla base:</strong> ${escapeHtml(templateUrl)}</p>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    async function handleSave() {
        setSaving(true);
        try {
            const response = await fetch(
                `/api/admin/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(currentDocument.id)}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        status,
                        form_data: formData,
                        notes: notes.trim() || null,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const updated = (await response.json()) as PatientDocument;
            onSaved(updated);
            toast.success('Documento guardado');
            onClose();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error al guardar documento';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={PATIENT_DOCUMENT_TYPE_LABELS[currentDocument.document_type]}
            maxWidth="4xl"
        >
            <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="settings-field">
                        <span className="form-label">Estado</span>
                        <select
                            className="form-input"
                            value={status}
                            onChange={(event) => setStatus(event.target.value as PatientDocumentStatus)}
                        >
                            <option value="draft">Borrador</option>
                            <option value="completed">Completado</option>
                            <option value="signed">Firmado</option>
                        </select>
                    </label>
                    <label className="settings-field">
                        <span className="form-label">Paciente</span>
                        <input className="form-input" value={patientName} readOnly />
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fields.map((field) => (
                        <label className={`settings-field ${field.type === 'textarea' ? 'md:col-span-2' : ''}`} key={field.key}>
                            <span className="form-label">{field.label}</span>
                            {field.type === 'textarea' ? (
                                <textarea
                                    className="form-input settings-textarea"
                                    rows={4}
                                    value={String(formData[field.key] ?? '')}
                                    placeholder={field.placeholder}
                                    onChange={(event) => updateField(field.key, event.target.value)}
                                />
                            ) : field.type === 'checkbox' ? (
                                <input
                                    type="checkbox"
                                    checked={Boolean(formData[field.key])}
                                    onChange={(event) => updateField(field.key, event.target.checked)}
                                />
                            ) : (
                                <input
                                    type={field.type}
                                    className="form-input"
                                    value={String(formData[field.key] ?? '')}
                                    placeholder={field.placeholder}
                                    onChange={(event) => updateField(field.key, event.target.value)}
                                />
                            )}
                        </label>
                    ))}
                </div>

                <label className="settings-field">
                    <span className="form-label">Notas internas</span>
                    <textarea
                        className="form-input settings-textarea"
                        rows={3}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                    />
                </label>

                <div className="flex flex-wrap gap-2 pt-2">
                    <a href={templateUrl} target="_blank" rel="noopener noreferrer" className="patient-record-add">
                        <Icon name="download" size={13} />
                        Abrir plantilla PDF
                    </a>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Icon name="print" size={13} />}
                        onClick={handlePrint}
                    >
                        Imprimir ficha rellenada
                    </Button>
                </div>
            </div>
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 flex justify-end gap-3 rounded-b-xl">
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                    Cancelar
                </Button>
                <Button type="button" variant="primary" onClick={handleSave} isLoading={saving}>
                    Guardar documento
                </Button>
            </div>
        </Modal>
    );
}
