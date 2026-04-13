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

export const RECORD_FIELDS: Record<RecordType, { label: string; placeholder: string }[]> = {
    anamnesis: [
        { label: 'Motivo de consulta', placeholder: 'Dolor lumbar de 2 semanas de evolución...' },
        { label: 'Antecedentes', placeholder: 'Cirugía de hernia discal en 2020...' },
        { label: 'Medicación actual', placeholder: 'Ibuprofeno 600mg cada 8h...' },
        { label: 'Observaciones', placeholder: 'Paciente refiere empeorar al estar sentado...' },
    ],
    exploration: [
        { label: 'Inspección visual', placeholder: 'Postura antálgica, cifosis dorsal acentuada...' },
        { label: 'Palpación', placeholder: 'Contractura paravertebral L4-L5 bilateral...' },
        { label: 'Movilidad', placeholder: 'Flexión lumbar limitada 50%, extensión dolorosa...' },
        { label: 'Tests específicos', placeholder: 'Lasègue negativo bilateral, Slump positivo dcha...' },
    ],
    evolution: [
        { label: 'Sesión realizada', placeholder: 'Terapia manual + electroterapia zona lumbar...' },
        { label: 'Respuesta del paciente', placeholder: 'Mejoría subjetiva del dolor 7/10 a 4/10...' },
        { label: 'Plan de tratamiento', placeholder: 'Continuar con 2 sesiones semanales, ejercicios...' },
    ],
    report: [
        { label: 'Diagnóstico fisioterapéutico', placeholder: 'Lumbociatalgia mecánica con componente miofascial...' },
        { label: 'Tratamiento realizado', placeholder: 'Se han realizado 8 sesiones de fisioterapia...' },
        { label: 'Resultados', placeholder: 'Mejoría del 80% en la escala EVA de dolor...' },
        { label: 'Recomendaciones', placeholder: 'Mantener ejercicios domiciliarios, revisión en 3 meses...' },
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
                                <label className="text-sm font-medium text-[var(--text-muted)]">{field.label}</label>
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
