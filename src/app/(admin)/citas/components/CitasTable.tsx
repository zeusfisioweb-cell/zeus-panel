'use client';

import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/Badge';
import { getAvatarColor, getInitials } from '@/lib/utils';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

interface CitasTableProps {
    appointments: Appointment[];
    onViewAppointment: (apt: Appointment) => void;
    onBulkConfirm?: (ids: string[]) => Promise<void>;
    onQuickStatus?: (id: string, status: AppointmentStatus) => Promise<void>;
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const STATUS_BADGE_VARIANT: Record<Appointment['status'], BadgeVariant> = {
    pending: 'warning',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'danger',
};

// ── Transition map: which statuses can an appointment move to? ──
const STATUS_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
    pending:   ['confirmed', 'completed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
};

const STATUS_ICONS: Partial<Record<AppointmentStatus, string>> = {
    confirmed: '✓',
    completed: '★',
    cancelled: '✕',
};

// ── Inline status dropdown ────────────────────────────────────
function StatusDropdown({
    appointment,
    onQuickStatus,
}: {
    appointment: Appointment;
    onQuickStatus?: (id: string, status: AppointmentStatus) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const transitions = STATUS_TRANSITIONS[appointment.status];

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    async function handleSelect(status: AppointmentStatus, e: React.MouseEvent) {
        e.stopPropagation();
        if (!onQuickStatus || loading) return;
        setLoading(true);
        try {
            await onQuickStatus(appointment.id, status);
        } finally {
            setLoading(false);
            setOpen(false);
        }
    }

    // No transitions available (completed / cancelled) → static badge
    if (!transitions || transitions.length === 0 || !onQuickStatus) {
        return (
            <Badge variant={STATUS_BADGE_VARIANT[appointment.status]} className="citas-status-chip">
                {STATUS_LABELS[appointment.status]}
            </Badge>
        );
    }

    return (
        <div ref={ref} className="citas-status-dropdown" onClick={e => e.stopPropagation()}>
            <button
                type="button"
                className={`citas-status-trigger citas-status-trigger--${appointment.status}${open ? ' is-open' : ''}`}
                onClick={() => setOpen(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={loading}
                title="Cambiar estado"
            >
                {loading ? <span className="citas-status-spinner" /> : STATUS_LABELS[appointment.status]}
                <Icon name="chevron-down" size={10} className="citas-status-trigger__chevron" />
            </button>

            {open && (
                <ul className="citas-status-menu" role="listbox" aria-label="Cambiar estado de la cita">
                    {transitions.map(s => (
                        <li key={s}>
                            <button
                                type="button"
                                className={`citas-status-menu__item citas-status-menu__item--${s}`}
                                role="option"
                                aria-selected={appointment.status === s}
                                onClick={e => handleSelect(s, e)}
                            >
                                <span className="citas-status-menu__icon">{STATUS_ICONS[s]}</span>
                                {STATUS_LABELS[s]}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function CitasTable({ appointments, onViewAppointment, onBulkConfirm, onQuickStatus }: CitasTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirming, setConfirming] = useState(false);

    const pendingAppointments = appointments.filter(a => a.status === 'pending');
    const allPendingSelected = pendingAppointments.length > 0 &&
        pendingAppointments.every(a => selectedIds.has(a.id));

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    }

    function toggleAllPending() {
        if (allPendingSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendingAppointments.map(a => a.id)));
        }
    }

    async function handleBulkConfirm() {
        if (!onBulkConfirm || selectedIds.size === 0) return;
        setConfirming(true);
        try {
            await onBulkConfirm(Array.from(selectedIds));
            setSelectedIds(new Set());
        } finally {
            setConfirming(false);
        }
    }

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
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '';
        const minutes = Math.round((end - start) / 60000);
        if (minutes < 60) return `${minutes} min`;
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
            if (!groups.has(dayKey)) groups.set(dayKey, []);
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
                <p className="citas-empty-state__text">No hay citas para los filtros actuales.</p>
            </div>
        );
    }

    return (
        <div className="citas-list ops-data-module">
            {/* Bulk action bar */}
            {onBulkConfirm && pendingAppointments.length > 0 && (
                <div className="citas-bulk-bar">
                    <label className="citas-bulk-bar__check">
                        <input
                            type="checkbox"
                            checked={allPendingSelected}
                            onChange={toggleAllPending}
                            aria-label="Seleccionar todas las pendientes"
                        />
                        <span>
                            {selectedIds.size > 0
                                ? `${selectedIds.size} seleccionada${selectedIds.size !== 1 ? 's' : ''}`
                                : `${pendingAppointments.length} pendiente${pendingAppointments.length !== 1 ? 's' : ''}`}
                        </span>
                    </label>
                    {selectedIds.size > 0 && (
                        <button
                            type="button"
                            className="citas-bulk-bar__confirm"
                            onClick={handleBulkConfirm}
                            disabled={confirming}
                        >
                            {confirming ? (
                                <span className="spinner spinner--sm" />
                            ) : (
                                <Icon name="check" size={14} />
                            )}
                            Confirmar {selectedIds.size}
                        </button>
                    )}
                </div>
            )}

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
                            const isPending = apt.status === 'pending';
                            const isSelected = selectedIds.has(apt.id);

                            return (
                                <li key={apt.id} className={isSelected ? 'citas-list-item--selected' : ''}>
                                    <div className="citas-list-item-row">
                                        {onBulkConfirm && isPending && (
                                            <label className="citas-list-item__checkbox" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(apt.id)}
                                                    aria-label={`Seleccionar cita de ${patientName}`}
                                                />
                                            </label>
                                        )}
                                        {onBulkConfirm && !isPending && (
                                            <div className="citas-list-item__checkbox-spacer" />
                                        )}
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
                                                    <span>{formatTime(apt.start_time)} - {formatTime(apt.end_time)}</span>
                                                </div>
                                                <span className="citas-time__duration pl-5">{getDuration(apt.start_time, apt.end_time)}</span>
                                            </div>

                                            <div className="citas-list-item__patient">
                                                <div className="citas-avatar" style={{ background: getAvatarColor(patientName) }}>
                                                    {getInitials(patientName)}
                                                </div>
                                                <div className="citas-list-item__content">
                                                    <span className="citas-list-item__label">Paciente</span>
                                                    <strong>{patientName}</strong>
                                                    <span className="opacity-80">{patientMeta || 'Sin documento/teléfono'}</span>
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

                                            <div className="citas-list-item__status" onClick={e => e.stopPropagation()}>
                                                <StatusDropdown
                                                    appointment={apt}
                                                    onQuickStatus={onQuickStatus}
                                                />
                                            </div>

                                            <div className="citas-list-item__action ml-auto text-[var(--accent-color)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                <span className="text-xs font-semibold uppercase tracking-wider">Ver detalle</span>
                                                <Icon name="chevron-right" size={16} />
                                            </div>
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
