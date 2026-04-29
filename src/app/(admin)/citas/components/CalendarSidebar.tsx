'use client';

import React, { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { format, isToday } from 'date-fns';
import type { Appointment } from '@/lib/types';
import './calendar-sidebar.css';

interface CalendarSidebarProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    appointments: Appointment[];
}

const STATUS_CONFIG = [
    { key: 'pending',   label: 'Pendientes', color: '#d97706' },
    { key: 'confirmed', label: 'Confirmadas', color: '#059669' },
    { key: 'completed', label: 'Completadas', color: '#2563eb' },
    { key: 'cancelled', label: 'Canceladas',  color: '#dc2626' },
] as const;

export function CalendarSidebar({ selectedDate, onSelectDate, appointments }: CalendarSidebarProps) {
    const busyDays = useMemo(() => {
        const seen = new Set<string>();
        appointments.forEach((a) => {
            if (a.status !== 'cancelled') seen.add(a.start_time.split('T')[0]);
        });
        return Array.from(seen).map((d) => {
            const [y, m, day] = d.split('-').map(Number);
            return new Date(y, m - 1, day, 12, 0, 0);
        });
    }, [appointments]);

    // Stats for selected day
    const dayStats = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dayApts = appointments.filter(a =>
            a.start_time.startsWith(dateStr)
        );
        const counts: Record<string, number> = {
            pending: 0, confirmed: 0, completed: 0, cancelled: 0,
        };
        dayApts.forEach(a => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
        return { total: dayApts.length, counts };
    }, [appointments, selectedDate]);

    const isSelectedToday = isToday(selectedDate);

    return (
        <aside className="zc-cal-sidebar" aria-label="Navegador de mes">
            <p className="zc-cal-sidebar__month">
                {format(selectedDate, 'MMMM yyyy', { locale: es })}
            </p>

            <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if (d) onSelectDate(d); }}
                locale={es}
                modifiers={{ busy: busyDays }}
                modifiersClassNames={{ busy: 'rdp-day--busy' }}
                classNames={{ root: 'zc-rdp' }}
            />

            {/* ── Day summary panel ── */}
            <div className="zc-cal-sidebar__divider" />

            <div className="zc-cal-sidebar__summary">
                <p className="zc-cal-sidebar__summary-title">
                    {isSelectedToday ? 'Hoy' : format(selectedDate, "d MMM", { locale: es })}
                    {dayStats.total > 0 && (
                        <span className="zc-cal-sidebar__summary-total">
                            {dayStats.total} cita{dayStats.total !== 1 ? 's' : ''}
                        </span>
                    )}
                </p>

                {dayStats.total === 0 ? (
                    <p className="zc-cal-sidebar__summary-empty">Sin citas este día</p>
                ) : (
                    <ul className="zc-cal-sidebar__stats">
                        {STATUS_CONFIG.map(({ key, label, color }) => {
                            const count = dayStats.counts[key] ?? 0;
                            if (count === 0) return null;
                            return (
                                <li key={key} className="zc-cal-sidebar__stat">
                                    <span
                                        className="zc-cal-sidebar__stat-dot"
                                        style={{ background: color }}
                                    />
                                    <span className="zc-cal-sidebar__stat-label">{label}</span>
                                    <span className="zc-cal-sidebar__stat-count">{count}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </aside>
    );
}
