'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PatientDocument, PatientDocumentType, PatientDocumentStatus } from '@/lib/types';
import { PATIENT_DOCUMENT_STATUS_LABELS, PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { readApiError } from '@/lib/api-helpers';
import {
    DOCUMENT_FIELDS,
    DOCUMENT_TYPE_OPTIONS,
    printDocument,
} from './document-fields';

interface PatientDocumentModalProps {
    isOpen: boolean;
    patientId: string;
    patientName: string;
    /** null = create mode, PatientDocument = edit mode */
    document: PatientDocument | null;
    onClose: () => void;
    onSaved: (document: PatientDocument) => void;
}

export function PatientDocumentModal({
    isOpen,
    patientId,
    patientName,
    document,
    onClose,
    onSaved,
}: PatientDocumentModalProps) {
    const isCreate = document === null;

    const [selectedType, setSelectedType] = useState<PatientDocumentType>('clinical_history');
    const [visitDate, setVisitDate] = useState('');
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [status, setStatus] = useState<PatientDocumentStatus>('draft');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (document) {
            setSelectedType(document.document_type);
            setFormData(document.form_data ?? {});
            setStatus(document.status);
            setNotes(document.notes ?? '');
            setVisitDate(document.visit_date ?? '');
        } else {
            setSelectedType('clinical_history');
            setFormData({});
            setStatus('draft');
            setNotes('');
            setVisitDate(new Date().toISOString().slice(0, 10));
        }
    }, [isOpen, document]);

    const activeType = isCreate ? selectedType : document!.document_type;
    const fields = useMemo(() => DOCUMENT_FIELDS[activeType], [activeType]);

    const templateUrl = `/consentimientos/${
        isCreate
            ? `${activeType}_template.pdf`
            : document!.template_file_name
    }`;

    function updateField(key: string, value: unknown) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    function handlePrint() {
        printDocument({
            typeLabel: PATIENT_DOCUMENT_TYPE_LABELS[activeType],
            subjectLine: `Paciente: ${patientName}`,
            statusLabel: PATIENT_DOCUMENT_STATUS_LABELS[status],
            fields,
            formData,
            notes,
            templateUrl,
        });
    }

    async function handleSave() {
        setSaving(true);
        try {
            let response: Response;

            if (isCreate) {
                response = await fetch(
                    `/api/admin/patients/${encodeURIComponent(patientId)}/documents`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            document_type: selectedType,
                            visit_date: visitDate || null,
                            status,
                            form_data: formData,
                            notes: notes.trim() || null,
                        }),
                    }
                );
            } else {
                response = await fetch(
                    `/api/admin/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(document!.id)}`,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            status,
                            form_data: formData,
                            notes: notes.trim() || null,
                            visit_date: visitDate || null,
                        }),
                    }
                );
            }

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const saved = (await response.json()) as PatientDocument;
            onSaved(saved);
            toast.success(isCreate ? 'Documento creado' : 'Documento guardado');
            onClose();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error al guardar documento';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    }

    const title = isCreate
        ? 'Nuevo documento'
        : PATIENT_DOCUMENT_TYPE_LABELS[document!.document_type];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="4xl">
            <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto p-6">

                {isCreate && (
                    <label className="settings-field">
                        <span className="form-label">Tipo de documento</span>
                        <select
                            className="form-input"
                            value={selectedType}
                            onChange={(e) => {
                                setSelectedType(e.target.value as PatientDocumentType);
                                setFormData({});
                            }}
                        >
                            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="settings-field">
                        <span className="form-label">Estado</span>
                        <select
                            className="form-input"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as PatientDocumentStatus)}
                        >
                            <option value="draft">Borrador</option>
                            <option value="completed">Completado</option>
                            <option value="signed">Firmado</option>
                        </select>
                    </label>
                    <label className="settings-field">
                        <span className="form-label">Fecha de visita</span>
                        <input
                            type="date"
                            className="form-input"
                            value={visitDate}
                            onChange={(e) => setVisitDate(e.target.value)}
                        />
                    </label>
                </div>

                <label className="settings-field">
                    <span className="form-label">Paciente</span>
                    <input className="form-input" value={patientName} readOnly />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fields.map((field) => (
                        <label
                            className={`settings-field ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}
                            key={field.key}
                        >
                            <span className="form-label">{field.label}</span>
                            {field.type === 'textarea' ? (
                                <textarea
                                    className="form-input settings-textarea"
                                    rows={4}
                                    value={String(formData[field.key] ?? '')}
                                    placeholder={field.placeholder}
                                    onChange={(e) => updateField(field.key, e.target.value)}
                                />
                            ) : field.type === 'checkbox' ? (
                                <input
                                    type="checkbox"
                                    checked={Boolean(formData[field.key])}
                                    onChange={(e) => updateField(field.key, e.target.checked)}
                                />
                            ) : (
                                <input
                                    type={field.type}
                                    className="form-input"
                                    value={String(formData[field.key] ?? '')}
                                    placeholder={field.placeholder}
                                    onChange={(e) => updateField(field.key, e.target.value)}
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
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </label>

                <div className="flex flex-wrap gap-2 pt-2">
                    <a
                        href={templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="patient-record-add"
                    >
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
                    {isCreate ? 'Crear documento' : 'Guardar cambios'}
                </Button>
            </div>
        </Modal>
    );
}
