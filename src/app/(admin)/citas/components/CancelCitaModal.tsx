import React, { useState } from 'react';
import Icon from '@/components/Icon';
import { Appointment } from '@/lib/types';
import { getAvatarColor, getInitials } from '@/lib/utils';
import { format } from 'date-fns';

interface CancelCitaModalProps {
    appointment: Appointment | null;
    isOpen: boolean;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export function CancelCitaModal({ appointment, isOpen, isLoading, onClose, onConfirm }: CancelCitaModalProps) {
    const [cancelReason, setCancelReason] = useState('');

    if (!isOpen || !appointment) return null;

    const formatTime = (iso: string) => format(new Date(iso), 'HH:mm');

    const handleConfirm = () => {
        onConfirm(cancelReason);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3 text-red-700">
                    <Icon name="alert-triangle" size={24} />
                    <h3 className="font-semibold text-lg">Cancelar cita</h3>
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-4 bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-color)] mb-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm" style={{ background: getAvatarColor(appointment.patient_name || 'V') }}>
                            {getInitials(appointment.patient_name || 'V')}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-semibold text-gray-900 truncate">{appointment.patient_name}</div>
                            <div className="text-sm text-gray-500 truncate">{formatTime(appointment.start_time)} — {appointment.service?.name}</div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Motivo de cancelación (opcional)</label>
                        <input
                            className="w-full h-10 px-3 rounded-md border border-[var(--border-color)] focus:outline-none focus:border-red-500 transition-colors"
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            placeholder="Ej: paciente no se presentó, reprogramada…"
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-hover)]">
                    <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors" onClick={onClose}>Volver</button>
                    <button className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition-colors flex items-center gap-2" onClick={handleConfirm} disabled={isLoading}>
                        {isLoading ? 'Cancelando...' : 'Sí, cancelar cita'}
                    </button>
                </div>
            </div>
        </div>
    );
}
