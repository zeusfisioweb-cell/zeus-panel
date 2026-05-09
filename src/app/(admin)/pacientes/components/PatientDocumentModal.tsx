'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PatientDocument, PatientDocumentType, PatientDocumentStatus } from '@/lib/types';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';
import { readApiError } from '@/lib/api-helpers';
import { useProfesionales } from '@/hooks/useProfesionales';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import {
    DOCUMENT_TYPE_OPTIONS,
    printDocument,
} from './document-fields';

interface PatientDocumentModalProps {
    isOpen: boolean;
    patientId: string;
    patientName: string;
    patientDocumentId?: string | null;
    /** null = create mode, PatientDocument = edit mode */
    document: PatientDocument | null;
    onClose: () => void;
    onSaved: (document: PatientDocument) => void;
}

export function PatientDocumentModal({
    isOpen,
    patientId,
    patientName,
    patientDocumentId,
    document,
    onClose,
    onSaved,
}: PatientDocumentModalProps) {
    const isCreate = document === null;
    const { data: professionals = [] } = useProfesionales();

    const [selectedType, setSelectedType] = useState<PatientDocumentType>('clinical_history');
    const [visitDate, setVisitDate] = useState('');
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [status, setStatus] = useState<PatientDocumentStatus>('draft');
    const [saving, setSaving] = useState(false);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (document) {
            setSelectedType(document.document_type);
            setFormData(document.form_data ?? {});
            setStatus(document.status);
            setVisitDate(document.visit_date ?? '');
        } else {
            setSelectedType('clinical_history');
            setFormData({});
            setStatus('draft');
            setVisitDate(new Date().toISOString().slice(0, 10));
        }
    }, [isOpen, document]);

    const activeType = isCreate ? selectedType : document!.document_type;
    const sections = useMemo(() => PATIENT_DOCUMENT_DEFINITIONS[activeType].sections, [activeType]);

    function updateField(key: string, value: unknown) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    async function handlePrint() {
        setPrinting(true);
        try {
            await printDocument({
                documentType: activeType,
                patientName,
                patientDocumentId,
                visitDate,
                formData,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudo generar el PDF';
            toast.error(message);
        } finally {
            setPrinting(false);
        }
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

                {sections.map((section) => (
                    <section key={section.title} className="border border-[var(--border-color)] rounded-lg p-3">
                        <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {section.fields.map((field) => (
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
                                    ) : field.type === 'professional_select' ? (
                                        <select
                                            className="form-input"
                                            value={String(formData[field.key] ?? '')}
                                            onChange={(e) => updateField(field.key, e.target.value)}
                                        >
                                            <option value="">— Seleccionar profesional —</option>
                                            {professionals
                                                .filter((p) => p.is_active)
                                                .map((p) => (
                                                    <option key={p.id} value={p.profile?.full_name ?? p.id}>
                                                        {p.profile?.full_name ?? 'Sin nombre'}
                                                        {p.specialty ? ` · ${p.specialty}` : ''}
                                                    </option>
                                                ))}
                                        </select>
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
                    </section>
                ))}

                <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Icon name="print" size={13} />}
                        isLoading={printing}
                        disabled={printing}
                        onClick={handlePrint}
                    >
                        Generar PDF base
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
