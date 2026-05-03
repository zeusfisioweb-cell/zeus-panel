'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/Icon';
import type { RecordType } from '@/lib/types';
import { RECORD_TYPE_LABELS, RECORD_TYPE_COLORS } from '@/lib/types';

interface ClinicalRecordFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialType: RecordType;
    onSubmit: (type: RecordType, recordFields: string[]) => Promise<void>;
}

export const RECORD_FIELDS: Record<RecordType, { key: string; label: string; placeholder: string; required?: boolean }[]> = {
    anamnesis: [
        { key: 'chief_complaint', label: 'Motivo de consulta', placeholder: 'Dolor lumbar de 2 semanas de evolución...', required: true },
        { key: 'medical_history', label: 'Antecedentes', placeholder: 'Cirugía de hernia discal en 2020...' },
        { key: 'medications', label: 'Medicación actual', placeholder: 'Ibuprofeno 600mg cada 8h...' },
        { key: 'observations', label: 'Observaciones', placeholder: 'Paciente refiere empeorar al estar sentado...' },
    ],
    exploration: [
        { key: 'visual_inspection', label: 'Inspección visual', placeholder: 'Postura antálgica, cifosis dorsal acentuada...' },
        { key: 'palpation', label: 'Palpación', placeholder: 'Contractura paravertebral L4-L5 bilateral...' },
        { key: 'mobility', label: 'Movilidad', placeholder: 'Flexión lumbar limitada 50%, extensión dolorosa...' },
        { key: 'specific_tests', label: 'Tests específicos', placeholder: 'Lasègue negativo bilateral, Slump positivo dcha...' },
    ],
    evolution: [
        { key: 'treatment_applied', label: 'Sesión realizada', placeholder: 'Terapia manual + electroterapia zona lumbar...', required: true },
        { key: 'patient_response', label: 'Respuesta del paciente', placeholder: 'Mejoría subjetiva del dolor 7/10 a 4/10...' },
        { key: 'next_session_plan', label: 'Plan de tratamiento', placeholder: 'Continuar con 2 sesiones semanales, ejercicios...' },
    ],
    report: [
        { key: 'diagnosis', label: 'Diagnóstico fisioterapéutico', placeholder: 'Lumbociatalgia mecánica con componente miofascial...', required: true },
        { key: 'treatment_applied', label: 'Tratamiento realizado', placeholder: 'Se han realizado 8 sesiones de fisioterapia...' },
        { key: 'results', label: 'Resultados', placeholder: 'Mejoría del 80% en la escala EVA de dolor...' },
        { key: 'recommendations', label: 'Recomendaciones', placeholder: 'Mantener ejercicios domiciliarios, revisión en 3 meses...' },
    ],
};

export function ClinicalRecordFormModal({ isOpen, onClose, initialType, onSubmit }: ClinicalRecordFormModalProps) {
    const [recordType, setRecordType] = useState<RecordType>(initialType);
    const [recordFields, setRecordFields] = useState<string[]>([]);
    const [savingRecord, setSavingRecord] = useState(false);
    const firstInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setRecordType(initialType);
            setRecordFields(RECORD_FIELDS[initialType].map(() => ''));
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen, initialType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingRecord(true);
        try {
            await onSubmit(recordType, recordFields);
            onClose();
        } catch {
            // Handled by parent
        } finally {
            setSavingRecord(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Nueva ${RECORD_TYPE_LABELS[recordType]}`}
            maxWidth="2xl"
        >
            <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
                <div className="p-6 overflow-y-auto w-full flex-1 space-y-6">
                    <div className="flex gap-2 mb-2 flex-wrap">
                        {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    setRecordType(type);
                                    setRecordFields(RECORD_FIELDS[type].map(() => ''));
                                    setTimeout(() => {
                                        firstInputRef.current?.focus();
                                    }, 50);
                                }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${recordType === type
                                    ? 'bg-opacity-15'
                                    : 'border-[var(--border-color)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                                    }`}
                                style={recordType === type ? {
                                    borderColor: RECORD_TYPE_COLORS[type],
                                    color: RECORD_TYPE_COLORS[type],
                                    backgroundColor: `${RECORD_TYPE_COLORS[type]}15`
                                } : {}}
                            >
                                {RECORD_TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4">
                        {RECORD_FIELDS[recordType].map((field, i) => (
                            <div key={`${recordType}-${i}`} className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[var(--text-muted)]">
                                    {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <textarea
                                    ref={i === 0 ? firstInputRef : null}
                                    className="w-full px-3 py-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus-visible:border-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(173,115,50,0.22)] transition-colors text-sm font-inherit min-h-[80px]"
                                    value={recordFields[i] || ''}
                                    onChange={e => {
                                        const updated = [...recordFields];
                                        updated[i] = e.target.value;
                                        setRecordFields(updated);
                                    }}
                                    placeholder={field.placeholder}
                                    style={{ resize: 'vertical' }}
                                    required={field.required}
                                    minLength={field.required ? 3 : undefined}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 flex justify-end gap-3 rounded-b-xl">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={savingRecord}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={savingRecord} isLoading={savingRecord} leftIcon={<Icon name="save" size={14} />}>
                        Guardar ficha
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
