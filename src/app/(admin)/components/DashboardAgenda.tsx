'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import Link from 'next/link';

interface DashboardAgendaProps {
    todayAppointments: Appointment[];
    totalActionableCount: number;
    onNewAppointmentClick: () => void;
    onUpdateStatus: (id: string, status: AppointmentStatus) => void;
}

const statusClassMap: Record<AppointmentStatus, string> = {
    pending: 'summary-v5-status--pending',
    confirmed: 'summary-v5-status--confirmed',
    completed: 'summary-v5-status--completed',
    cancelled: 'summary-v5-status--cancelled',
};

const statusLabelMap: Record<AppointmentStatus, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Finalizada',
    cancelled: 'Cancelada',
};

export function DashboardAgenda({
    todayAppointments,
    totalActionableCount,
    onNewAppointmentClick,
    onUpdateStatus,
}: DashboardAgendaProps) {
    const [isCompactMobile, setIsCompactMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 540px)');
        const apply = () => setIsCompactMobile(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    const visibleAppointments = isCompactMobile ? todayAppointments.slice(0, 3) : todayAppointments;
    const hiddenAppointmentsCount = Math.max(0, totalActionableCount - visibleAppointments.length);

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <section className="summary-v5-panel summary-v5-panel--agenda">
            <div className="summary-v5-panel__header">
                <div>
                    <h2 className="summary-v5-panel__title">Agenda de hoy</h2>
                    <p className="summary-v5-panel__hint">
                        {visibleAppointments.length} de {totalActionableCount} citas confirmadas hoy
                    </p>
                </div>
                <Link href="/citas" className="btn btn--ghost btn--sm">
                    Abrir agenda
                </Link>
            </div>

            {visibleAppointments.length === 0 ? (
                <div className="zs-agenda-empty">
                    <div className="zs-agenda-empty__icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                            <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>
                            <path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
                        </svg>
                    </div>
                    <p className="zs-agenda-empty__title">Día libre de citas</p>
                    <p className="zs-agenda-empty__text">Sin sesiones confirmadas para hoy.</p>
                    <button className="btn btn--primary btn--sm" type="button" onClick={onNewAppointmentClick}>
                        Crear nueva cita
                    </button>
                </div>
            ) : (
                <ol className="summary-v5-timeline">
                    {visibleAppointments.map((apt) => {
                        const hasPhone = Boolean(apt.patient_phone);
                        return (
                            <li key={apt.id} className={`summary-v5-timeline__item summary-v5-timeline__item--${apt.status}`}>
                                <div className="summary-v5-timeline__time">
                                    <strong>{formatTime(apt.start_time)}</strong>
                                    <span>{formatTime(apt.end_time)}</span>
                                </div>

                                <div className="summary-v5-timeline__body">
                                    <div className="summary-v5-timeline__head">
                                        <p className="summary-v5-timeline__patient">{apt.patient_name || 'Paciente'}</p>
                                        <span className={`summary-v5-status ${statusClassMap[apt.status]}`}>{statusLabelMap[apt.status]}</span>
                                    </div>
                                    <p className="summary-v5-timeline__meta">
                                        {apt.service?.name || 'Servicio'} | {apt.professional?.profile?.full_name || 'Sin profesional'}
                                    </p>
                                </div>

                                <div className="summary-v5-timeline__actions">
                                    {apt.status === 'pending' && (
                                        <button className="btn btn--primary btn--sm" onClick={() => onUpdateStatus(apt.id, 'confirmed')}>
                                            Confirmar
                                        </button>
                                    )}

                                    {apt.status === 'confirmed' && (
                                        <button className="btn btn--primary btn--sm" onClick={() => onUpdateStatus(apt.id, 'completed')}>
                                            Finalizar
                                        </button>
                                    )}

                                    {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                        <button className="btn btn--ghost btn--sm" onClick={() => onUpdateStatus(apt.id, 'cancelled')}>
                                            Cancelar
                                        </button>
                                    )}

                                    {apt.status === 'pending' && hasPhone && (
                                        <a
                                            href={`https://wa.me/${apt.patient_phone?.replace(/\D/g, '') || ''}?text=Hola ${encodeURIComponent(apt.patient_name || '')}, te escribimos desde la clínica para confirmar tu cita de ${apt.service?.name} hoy a las ${formatTime(apt.start_time)}.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn--secondary btn--sm summary-v5-timeline__wa"
                                        >
                                            Confirmar WA
                                        </a>
                                    )}

                                    {apt.status === 'confirmed' && hasPhone && (
                                        <a
                                            href={`https://wa.me/${apt.patient_phone?.replace(/\D/g, '') || ''}?text=Hola ${encodeURIComponent(apt.patient_name || '')}, recordatorio de tu cita de ${apt.service?.name} hoy a las ${formatTime(apt.start_time)}. Te esperamos.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn--secondary btn--sm summary-v5-timeline__wa"
                                        >
                                            Recordatorio WA
                                        </a>
                                    )}

                                    {apt.status === 'completed' && hasPhone && (
                                        <a
                                            href={`https://wa.me/${apt.patient_phone?.replace(/\D/g, '') || ''}?text=Hola ${encodeURIComponent(apt.patient_name || '')}, gracias por venir a tu sesión de ${apt.service?.name}. Si puedes, déjanos una reseña en Google.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn--secondary btn--sm summary-v5-timeline__wa"
                                        >
                                            Feedback WA
                                        </a>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                    {hiddenAppointmentsCount > 0 && (
                        <li className="summary-v5-timeline__more mt-1">
                            <Link href="/citas" className="btn btn--ghost btn--sm w-full justify-center">
                                Ver las {hiddenAppointmentsCount} citas restantes
                            </Link>
                        </li>
                    )}
                </ol>
            )}
        </section>
    );
}
