import React from 'react';
import { format, subMonths, addMonths, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from '@/components/Icon';
import { isSameDay } from '@/lib/utils';
import type { Appointment } from '@/lib/types';

interface CitasSidebarProps {
    calMonth: Date;
    setCalMonth: React.Dispatch<React.SetStateAction<Date>>;
    miniCalDays: Date[];
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    aptsByDay: Record<string, number>;
    dayAppointments: Appointment[];
    onNewAppointment: () => void;
    onAppointmentClick: (apt: Appointment) => void;
}

export function CitasSidebar({
    calMonth,
    setCalMonth,
    miniCalDays,
    selectedDate,
    setSelectedDate,
    aptsByDay,
    dayAppointments,
    onNewAppointment,
    onAppointmentClick,
}: CitasSidebarProps) {
    const formatTimeOffset = (iso: string) => {
        return new Date(iso).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="zc-sidebar-cal zc-sidebar-cal--clean h-full flex flex-col gap-4">
            <div className="zc-mini-cal bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
                <div className="zc-mini-cal__nav flex justify-between items-center mb-4">
                    <button
                        type="button"
                        className="zc-mini-cal__nav-btn"
                        onClick={() => setCalMonth((m) => subMonths(m, 1))}
                        aria-label="Mes anterior"
                    >
                        <Icon name="chevron-left" size={17} />
                    </button>

                    <span className="zc-mini-cal__month font-semibold capitalize text-sm text-[var(--text-primary)]">
                        {format(calMonth, 'MMMM yyyy', { locale: es })}
                    </span>

                    <button
                        type="button"
                        className="zc-mini-cal__nav-btn"
                        onClick={() => setCalMonth((m) => addMonths(m, 1))}
                        aria-label="Mes siguiente"
                    >
                        <Icon name="chevron-right" size={17} />
                    </button>
                </div>

                <div className="zc-mini-cal__grid grid grid-cols-7 gap-y-2 gap-x-1 text-center text-xs">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                        <div key={d} className="font-semibold text-[var(--text-muted)] py-1">{d}</div>
                    ))}

                    {miniCalDays.map((day, i) => {
                        const inMonth = day.getMonth() === calMonth.getMonth();
                        const selected = isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const dayKey = day.toISOString().split('T')[0];
                        const count = aptsByDay[dayKey] || 0;

                        return (
                            <button
                                key={i}
                                type="button"
                                aria-label={format(day, 'EEEE d MMMM', { locale: es })}
                                className={`zc-mini-cal__day
                                    ${!inMonth ? 'is-out' : ''}
                                    ${selected ? 'is-selected' : ''}
                                    ${isTodayDate ? 'is-today' : ''}`}
                                onClick={() => setSelectedDate(day)}
                            >
                                <span className="z-10">{day.getDate()}</span>
                                {count > 0 && <span className="zc-mini-cal__dot" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="zc-upcoming flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                    <h3 className="zc-upcoming__title">Próximas citas</h3>
                    <span className="zc-upcoming__count">{dayAppointments.length}</span>
                </div>

                <div className="overflow-y-auto p-3 space-y-2.5 flex-1">
                    {dayAppointments.length === 0 && (
                        <div className="zc-upcoming-empty">
                            <div className="zc-upcoming-empty__icon">
                                <Icon name="calendar" size={22} className="text-[var(--text-muted)]" />
                            </div>
                            <p className="zc-upcoming-empty__title">Día libre</p>
                            <p className="zc-upcoming-empty__text">No hay citas en la fecha seleccionada.</p>
                            <button
                                type="button"
                                className="zc-upcoming-empty__btn"
                                onClick={onNewAppointment}
                            >
                                <Icon name="plus" size={15} />
                                Agendar cita
                            </button>
                        </div>
                    )}

                    {dayAppointments.map((apt) => (
                        <button
                            key={apt.id}
                            type="button"
                            className="zc-upcoming-item"
                            onClick={() => onAppointmentClick(apt)}
                        >
                            <div className="zc-upcoming-item__top">
                                <span
                                    className="zc-upcoming-item__dot"
                                    style={{ background: 'var(--text-main)' }}
                                />
                                <span className="zc-upcoming-item__time">
                                    {formatTimeOffset(apt.start_time)} - {formatTimeOffset(apt.end_time)}
                                </span>
                                <Icon name="chevron-right" size={14} className="zc-upcoming-item__arrow" />
                            </div>

                            <strong className="zc-upcoming-item__patient">{apt.patient_name || 'Paciente'}</strong>
                            <span className="zc-upcoming-item__service">{apt.service?.name || 'Cita general'}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
