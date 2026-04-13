import React, { useEffect, useId, useState } from 'react';
import { format } from 'date-fns';
import Icon from '@/components/Icon';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Appointment } from '@/lib/types';
import { getAvatarColor, getInitials } from '@/lib/utils';

interface CancelCitaModalProps {
    appointment: Appointment | null;
    isOpen: boolean;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export function CancelCitaModal({ appointment, isOpen, isLoading, onClose, onConfirm }: CancelCitaModalProps) {
    const [cancelReason, setCancelReason] = useState('');
    const reasonId = useId();

    useEffect(() => {
        if (isOpen) {
            setCancelReason('');
        }
    }, [isOpen, appointment?.id]);

    if (!appointment) return null;

    const formatTime = (iso: string) => format(new Date(iso), 'HH:mm');

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onConfirm(cancelReason.trim());
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cancelar cita" maxWidth="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm font-semibold flex items-center gap-2">
                    <Icon name="alert-triangle" size={16} />
                    Esta accion cambiara el estado de la cita a cancelada.
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-hover)] p-3">
                    <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-extrabold shrink-0"
                        style={{ background: getAvatarColor(appointment.patient_name || 'P') }}
                    >
                        {getInitials(appointment.patient_name || 'P')}
                    </div>

                    <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[var(--text-main)] truncate">
                            {appointment.patient_name || 'Paciente'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                            {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                            {appointment.service?.name || 'Cita general'}
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor={reasonId} className="form-label !mb-0">
                        Motivo de cancelacion (opcional)
                    </label>
                    <textarea
                        id={reasonId}
                        name="cancel_reason"
                        className="form-input min-h-[96px] h-auto"
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Ej: paciente no se presento…"
                        rows={3}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                        Volver
                    </Button>
                    <Button type="submit" variant="danger" isLoading={isLoading} disabled={isLoading}>
                        {isLoading ? 'Cancelando…' : 'Confirmar cancelacion'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
