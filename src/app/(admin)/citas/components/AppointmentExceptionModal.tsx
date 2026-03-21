'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Icon from '@/components/Icon';
import type { Professional } from '@/lib/types';

export interface ExceptionFormData {
    professional_id: string;
    exception_date: string;
    start_time: string;
    end_time: string;
    reason: string;
}

interface AppointmentExceptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    professionals: Professional[];
    onSubmit: (form: ExceptionFormData) => Promise<void>;
}

export function AppointmentExceptionModal({
    isOpen,
    onClose,
    selectedDate,
    professionals,
    onSubmit
}: AppointmentExceptionModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState<ExceptionFormData>({
        professional_id: '',
        exception_date: '',
        start_time: '',
        end_time: '',
        reason: '',
    });

    useEffect(() => {
        if (isOpen) {
            setForm({
                professional_id: professionals[0]?.id || '',
                exception_date: selectedDate.toISOString().split('T')[0],
                start_time: '',
                end_time: '',
                reason: '',
            });
        }
    }, [isOpen, selectedDate, professionals]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(form);
            onClose();
        } catch (error) {
            // Error managed by parent
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Bloquear Horario"
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col">
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">Profesional *</label>
                        <select
                            className="form-input form-select"
                            value={form.professional_id}
                            onChange={e => setForm({ ...form, professional_id: e.target.value })}
                            required
                        >
                            <option value="" disabled>Seleccionar…</option>
                            {professionals.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.profile?.full_name || 'Profesional'}
                                    {p.specialty ? ` — ${p.specialty}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Input
                        label="Fecha *"
                        type="date"
                        required
                        value={form.exception_date}
                        onChange={e => setForm({ ...form, exception_date: e.target.value })}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Input
                                label="Hora Inicio"
                                type="time"
                                value={form.start_time}
                                onChange={e => setForm({ ...form, start_time: e.target.value })}
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-1">Dejar vacío para bloqueos de día completo</p>
                        </div>
                        <Input
                            label="Hora Fin"
                            type="time"
                            value={form.end_time}
                            onChange={e => setForm({ ...form, end_time: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Motivo"
                        value={form.reason}
                        onChange={e => setForm({ ...form, reason: e.target.value })}
                        placeholder="Ej: Vacaciones, baja médica…"
                    />
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 flex justify-end gap-3 rounded-b-xl">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting} leftIcon={<Icon name="lock" size={14} />}>
                        Bloquear
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
