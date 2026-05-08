'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PatientDocumentType } from '@/lib/types';
import { PATIENT_DOCUMENT_TYPE_LABELS } from '@/lib/types';
import {
    DOCUMENT_FIELDS,
    DOCUMENT_TYPE_OPTIONS,
    printDocument,
} from './document-fields';

interface TemplateGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function TemplateGeneratorModal({ isOpen, onClose }: TemplateGeneratorModalProps) {
    const [selectedType, setSelectedType] = useState<PatientDocumentType>('clinical_history');
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [notes, setNotes] = useState('');

    const fields = useMemo(() => DOCUMENT_FIELDS[selectedType], [selectedType]);
    const templateUrl = `/consentimientos/${selectedType}_template.pdf`;

    function updateField(key: string, value: unknown) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    function handleTypeChange(type: PatientDocumentType) {
        setSelectedType(type);
        setFormData({});
        setNotes('');
    }

    function handlePrint() {
        printDocument({
            typeLabel: PATIENT_DOCUMENT_TYPE_LABELS[selectedType],
            subjectLine: 'Documento sin paciente asignado',
            statusLabel: '—',
            fields,
            formData,
            notes,
            templateUrl,
        });
    }

    function handleReset() {
        setFormData({});
        setNotes('');
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generador de plantillas" maxWidth="4xl">
            <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto p-6">
                <p className="text-sm text-[var(--text-muted)]">
                    Rellena y genera un PDF sin asociarlo a ningún paciente.
                </p>

                <div className="flex gap-2 flex-wrap">
                    {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleTypeChange(opt.value as PatientDocumentType)}
                            className={`zs-drawer__tab ${selectedType === opt.value ? 'is-active' : ''}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

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
                    <span className="form-label">Notas</span>
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
                        Abrir plantilla PDF base
                    </a>
                </div>
            </div>

            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 flex justify-between gap-3 rounded-b-xl">
                <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                    Limpiar campos
                </Button>
                <div className="flex gap-3">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        leftIcon={<Icon name="print" size={14} />}
                        onClick={handlePrint}
                    >
                        Imprimir / Generar PDF
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
