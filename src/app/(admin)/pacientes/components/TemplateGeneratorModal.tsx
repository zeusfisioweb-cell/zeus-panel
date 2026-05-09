'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PatientDocumentType } from '@/lib/types';
import { useProfesionales } from '@/hooks/useProfesionales';
import { PATIENT_DOCUMENT_DEFINITIONS } from '@/lib/patient-document-definitions';
import {
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
    const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));

    const { data: professionals = [] } = useProfesionales();
    const sections = useMemo(() => PATIENT_DOCUMENT_DEFINITIONS[selectedType].sections, [selectedType]);

    function updateField(key: string, value: unknown) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    function handleTypeChange(type: PatientDocumentType) {
        setSelectedType(type);
        setFormData({});
    }

    function handlePrint() {
        printDocument({
            documentType: selectedType,
            patientName: '___________________________',
            visitDate,
            formData,
        });
    }

    function handleReset() {
        setFormData({});
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

                <label className="settings-field">
                    <span className="form-label">Fecha del documento</span>
                    <input
                        type="date"
                        className="form-input"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        style={{ maxWidth: 200 }}
                    />
                </label>

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

                <p className="text-xs text-[var(--text-muted)]">
                    El PDF se genera con el nombre del paciente en blanco. Para documentos asociados a un paciente, usa el tab &quot;Documentos&quot; en su ficha.
                </p>
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
