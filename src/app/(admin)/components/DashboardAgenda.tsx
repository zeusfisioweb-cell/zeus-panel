'use client';

import React from 'react';
import Icon from '@/components/Icon';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/types';

interface DashboardAgendaProps {
    todayAppointments: Appointment[];
    onNewAppointmentClick: () => void;
    onUpdateStatus: (id: string, status: AppointmentStatus) => void;
}

export function DashboardAgenda({ todayAppointments, onNewAppointmentClick, onUpdateStatus }: DashboardAgendaProps) {
    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const activeAppointments = todayAppointments.filter((a) => a.status !== 'cancelled');

    return (
        <div className="card agenda-card agenda-card--today">
            <div className="card__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 className="card__title">Agenda de hoy</h2>
                    <span className="pill pill--blue">{activeAppointments.length} activas</span>
                </div>
            </div>

            <div className="card__body">
                {activeAppointments.length === 0 ? (
                    <div className="empty-state agenda-empty-state">
                        <div className="empty-state__icon"><Icon name="calendar" size={36} /></div>
                        <div className="empty-state__title">Sin citas para hoy</div>
                        <div className="empty-state__text">No hay sesiones programadas en la agenda.</div>
                        <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={onNewAppointmentClick}>
                            <Icon name="plus" size={16} /> Nueva cita
                        </button>
                    </div>
                ) : (
                    <div className="agenda-list">
                        {activeAppointments.map((apt, index) => {
                            const color = STATUS_COLORS[apt.status] || 'var(--accent)';

                            return (
                                <article key={apt.id} className="agenda-item agenda-item--interactive animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="agenda-item__time">
                                        <strong>{formatTime(apt.start_time)}</strong>
                                        <span>{formatTime(apt.end_time)}</span>
                                    </div>

                                    <div className="agenda-item__dot-wrap">
                                        <span className="agenda-item__dot" style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}20` }} />
                                        {index < activeAppointments.length - 1 && <span className="agenda-item__line" />}
                                    </div>

                                    <div className="agenda-item__content">
                                        <p className="agenda-item__title">{apt.patient_name || 'Paciente'}</p>

                                        <p className="agenda-item__meta">
                                            <Icon name="activity" size={14} /> {apt.service?.name || 'Servicio'}
                                        </p>

                                        {apt.professional?.profile?.full_name && (
                                            <p className="agenda-item__meta">
                                                <Icon name="users" size={12} />
                                                {apt.professional.profile.full_name}
                                            </p>
                                        )}
                                    </div>

                                    <div className="agenda-item__actions">
                                        {apt.status === 'pending' && (
                                            <>
                                                <button
                                                    className="btn btn--primary btn--sm"
                                                    onClick={() => onUpdateStatus(apt.id, 'confirmed')}
                                                    title="Confirmar cita"
                                                >
                                                    <Icon name="check" size={14} /> Confirmar
                                                </button>

                                                <a
                                                    href={`https://wa.me/${apt.patient_phone?.replace(/\D/g, '') || ''}?text=Hola ${encodeURIComponent(apt.patient_name || '')}, te escribimos de la clinica para confirmar tu cita de ${apt.service?.name} hoy a las ${formatTime(apt.start_time)}.`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn--secondary btn--sm agenda-item__wa-btn"
                                                    title="Enviar WhatsApp"
                                                >
                                                    WA
                                                </a>
                                            </>
                                        )}

                                        {apt.status === 'confirmed' && (
                                            <button
                                                className="btn btn--primary btn--sm"
                                                onClick={() => onUpdateStatus(apt.id, 'completed')}
                                                title="Marcar finalizada"
                                            >
                                                <Icon name="check" size={14} /> Finalizar
                                            </button>
                                        )}

                                        {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                            <button
                                                className="btn btn--ghost btn--sm"
                                                onClick={() => onUpdateStatus(apt.id, 'cancelled')}
                                                title="Cancelar cita"
                                            >
                                                <Icon name="close" size={14} />
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
