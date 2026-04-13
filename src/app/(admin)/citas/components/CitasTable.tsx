'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/Badge';
import { getAvatarColor, getInitials } from '@/lib/utils';
import type { Appointment } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

interface CitasTableProps {
    appointments: Appointment[];
    onViewAppointment: (apt: Appointment) => void;
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const STATUS_BADGE_VARIANT: Record<Appointment['status'], BadgeVariant> = {
    pending: 'warning',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'danger',
};

export function CitasTable({ appointments, onViewAppointment }: CitasTableProps) {
    const formatDate = (isoDate: string) => {
        try {
            return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return isoDate;
        }
    };

    const formatTime = (isoDateTime: string) => {
        try {
            return new Date(isoDateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const getDuration = (startIso: string, endIso: string) => {
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return '';
        }

        const minutes = Math.round((end - start) / 60000);
        if (minutes < 60) {
            return `${minutes} min`;
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
    };

    const groupedAppointments = React.useMemo(() => {
        const groups = new Map<string, Appointment[]>();
        const sorted = [...appointments].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        sorted.forEach((appointment) => {
            const dayKey = appointment.start_time.split('T')[0];
            if (!groups.has(dayKey)) {
                groups.set(dayKey, []);
            }

            groups.get(dayKey)?.push(appointment);
        });

        return Array.from(groups.entries());
    }, [appointments]);

    if (appointments.length === 0) {
        return (
            <div className="citas-empty-state">
                <div className="citas-empty-state__icon">
                    <Icon name="calendar" size={32} className="text-[var(--text-muted)]" />
                </div>
                <h3 className="citas-empty-state__title">Sin resultados</h3>
                <p className="citas-empty-state__text">
                    No hay citas para los filtros actuales.
                </p>
            </div>
        );
    }

    return (
        <div className="citas-list ops-data-module">
            {groupedAppointments.map(([dayKey, dayAppointments]) => (
                <section className="citas-list-day" key={dayKey}>
                    <header className="citas-list-day__head">
                        <h3 className="citas-list-day__title">{formatDate(dayKey)}</h3>
                        <span className="citas-list-day__count">
                            {dayAppointments.length} cita{dayAppointments.length === 1 ? '' : 's'}
                        </span>
                    </header>

                    <ul className="citas-list-day__items">
                        {dayAppointments.map((apt) => {
                            const patientName = apt.patient_name || 'Paciente sin nombre';
                            const patientMeta = [apt.patient?.document_id, apt.patient_phone].filter(Boolean).join(' | ');
                            const professionalName = apt.professional?.profile?.full_name || 'Sin profesional asignado';

                            return (
                                <li key={apt.id}>
                                    <button
                                        type="button"
                                        className="citas-list-item citas-list-item--ops group"
                                        onClick={() => onViewAppointment(apt)}
                                        title="Ver detalle de cita"
                                        style={{ borderLeftColor: apt.professional?.color_code || 'var(--line-soft)', borderLeftWidth: '4px' }}
                                    >
                                        <div className="citas-list-item__time">
                                            <div className="citas-time__range">
                                                <Icon name="clock" size={14} className="opacity-70" />
                                                <span>
                                                    {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                                                </span>
                                            </div>
                                            <span className="citas-time__duration pl-5">{getDuration(apt.start_time, apt.end_time)}</span>
                                        </div>

                                        <div className="citas-list-item__patient">
                                            <div
                                                className="citas-avatar"
                                                style={{ background: getAvatarColor(patientName) }}
                                            >
                                                {getInitials(patientName)}
                                            </div>
                                            <div className="citas-list-item__content">
                                                <span className="citas-list-item__label">Paciente</span>
                                                <strong>{patientName}</strong>
                                                <span className="opacity-80">{patientMeta || 'Sin documento/telefono'}</span>
                                            </div>
                                        </div>

                                        <div className="citas-list-item__service">
                                            <span
                                                className="citas-service-dot shadow-sm"
                                                style={{ background: apt.professional?.color_code || 'var(--text-main)' }}
                                            />
                                            <div className="citas-list-item__content">
                                                <span className="citas-list-item__label">Profesional / Serv.</span>
                                                <strong style={{ color: apt.professional?.color_code || 'inherit' }}>{professionalName}</strong>
                                                <span className="opacity-80 font-medium">{apt.service?.name || 'Cita general'}</span>
                                            </div>
                                        </div>

                                        <div className="citas-list-item__status">
                                            <Badge
                                                variant={STATUS_BADGE_VARIANT[apt.status]}
                                                className="citas-status-chip"
                                            >
                                                {STATUS_LABELS[apt.status] || apt.status}
                                            </Badge>
                                        </div>

                                        <div className="citas-list-item__action ml-auto text-[var(--accent-color)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Ver detalle</span>
                                            <Icon name="chevron-right" size={16} />
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
