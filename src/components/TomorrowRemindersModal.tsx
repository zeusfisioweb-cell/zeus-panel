'use client';

import { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { useCitas } from '@/hooks/useCitas';
import { buildWaLink, reminderMessage } from '@/lib/whatsapp-messages';
import type { Appointment } from '@/lib/types';
import Icon from './Icon';

interface TomorrowRemindersModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CLINIC_TIME_ZONE = 'Europe/Madrid';

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: CLINIC_TIME_ZONE,
    });
}

export function TomorrowRemindersModal({ isOpen, onClose }: TomorrowRemindersModalProps) {
    const [sent, setSent] = useState<Set<string>>(new Set());

    const { startIso, endIso, tomorrowLabel } = useMemo(() => {
        const tomorrow = DateTime.now().setZone(CLINIC_TIME_ZONE).plus({ days: 1 }).startOf('day');
        const dayAfter = tomorrow.plus({ days: 1 });
        return {
            startIso: tomorrow.toISO() ?? '',
            endIso: dayAfter.toISO() ?? '',
            tomorrowLabel: tomorrow.setLocale('es').toFormat("cccc d 'de' LLLL"),
        };
    }, []);

    const { data: appointments = [], isLoading } = useCitas(isOpen ? startIso : undefined, isOpen ? endIso : undefined);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const eligible: Appointment[] = appointments
        .filter((apt) => apt.status === 'confirmed' || apt.status === 'pending')
        .filter((apt) => Boolean(apt.patient_phone))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const total = eligible.length;
    const sentCount = eligible.filter((a) => sent.has(a.id)).length;

    const handleSent = (id: string) => {
        setSent((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    const handleReset = () => setSent(new Set());

    const handleClose = () => {
        onClose();
        setSent(new Set());
    };

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
            <div
                className="modal flex flex-col"
                style={{ maxWidth: 560, width: '100%' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="modal__header shrink-0">
                    <h3 className="modal__title flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        Recordatorios WhatsApp · mañana
                    </h3>
                    <button className="modal__close" onClick={handleClose} aria-label="Cerrar">
                        <Icon name="x" size={18} />
                    </button>
                </div>

                <div className="modal__body overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                        {tomorrowLabel.charAt(0).toUpperCase() + tomorrowLabel.slice(1)} · {total} {total === 1 ? 'cita' : 'citas'} con teléfono
                        {total > 0 && ` · ${sentCount}/${total} enviados`}
                    </p>

                    {isLoading && (
                        <div className="flex justify-center py-8"><div className="spinner" /></div>
                    )}

                    {!isLoading && total === 0 && (
                        <p className="text-sm text-[var(--text-muted)] py-6 text-center">
                            No hay citas con teléfono para mañana.
                        </p>
                    )}

                    {!isLoading && total > 0 && (
                        <ul className="flex flex-col gap-2">
                            {eligible.map((apt) => {
                                const time = formatTime(apt.start_time);
                                const text = reminderMessage({
                                    patientName: apt.patient_name,
                                    serviceName: apt.service?.name,
                                    time,
                                    dateLabel: 'mañana',
                                });
                                const href = buildWaLink(text, apt.patient_phone);
                                const isSent = sent.has(apt.id);
                                return (
                                    <li
                                        key={apt.id}
                                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border-color)]"
                                        style={{ opacity: isSent ? 0.55 : 1 }}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate">{apt.patient_name || 'Paciente'}</span>
                                            <span className="text-xs text-[var(--text-secondary)] truncate">
                                                {time} · {apt.service?.name || 'Servicio'}
                                            </span>
                                        </div>
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`btn btn--sm shrink-0 ${isSent ? 'btn--ghost' : 'btn--primary'}`}
                                            onClick={() => handleSent(apt.id)}
                                        >
                                            {isSent ? 'Reenviar' : 'Enviar WA'}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="modal__footer shrink-0 flex justify-between gap-3 p-4">
                    <button
                        type="button"
                        className="btn btn--ghost !m-0"
                        onClick={handleReset}
                        disabled={sentCount === 0}
                    >
                        Reiniciar
                    </button>
                    <button type="button" className="btn btn--primary !m-0" onClick={handleClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
