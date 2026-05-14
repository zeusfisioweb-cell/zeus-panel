'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/Icon';
import type { Appointment } from '@/lib/types';
import { DateTime } from 'luxon';

const CLINIC_TZ = 'Europe/Madrid';

interface RescheduleModalProps {
    appointment: Appointment | null;
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onSubmit: (id: string, newStart: Date, newEnd: Date) => Promise<void>;
}

export function RescheduleModal({ appointment, isOpen, isLoading, onClose, onSubmit }: RescheduleModalProps) {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!appointment || !isOpen) return;
        const start = DateTime.fromISO(appointment.start_time, { zone: CLINIC_TZ });
        setDate(start.toISODate() ?? '');
        setTime(start.toFormat('HH:mm'));
        setError('');
    }, [appointment, isOpen]);

    if (!appointment) return null;

    const durationMs = new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime();
    const patName = appointment.patient
        ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
        : appointment.patient_name ?? 'Paciente';
    const svcName = appointment.service?.name ?? 'Cita';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const newStart = DateTime.fromISO(`${date}T${time}`, { zone: CLINIC_TZ });
        if (!newStart.isValid) { setError('Fecha u hora inválida'); return; }

        const newEnd = new Date(newStart.toJSDate().getTime() + durationMs);

        try {
            await onSubmit(appointment.id, newStart.toJSDate(), newEnd);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo reprogramar la cita');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reprogramar cita">
            <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-subtle,#f8f7f4)] border border-[var(--border-color)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent,#6366f1)] flex items-center justify-center flex-shrink-0">
                        <Icon name="calendar" size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{patName}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{svcName}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">Nueva fecha</label>
                        <input
                            type="date"
                            className="input-base"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">Nueva hora</label>
                        <input
                            type="time"
                            className="input-base"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 flex items-center gap-1.5">
                            <Icon name="alert-circle" size={12} />
                            {error}
                        </p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" className="flex-1 justify-center" isLoading={isLoading}>
                            Reprogramar
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
