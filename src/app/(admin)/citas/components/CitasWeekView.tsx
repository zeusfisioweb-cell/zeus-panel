import React from 'react';
import { format, subWeeks, addWeeks, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from '@/components/Icon';
import { isSameDay } from '@/lib/utils';
import type { Appointment } from '@/lib/types';

interface CitasWeekViewProps {
    selectedDate: Date;
    setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
    visibleDays: Date[];
    setCalViewMode: React.Dispatch<React.SetStateAction<'list' | 'day' | 'week'>>;
    getDay: (date: Date) => Appointment[];
    isDragging: boolean;
    draggedAppointment: Appointment | null;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDropWeek: (e: React.DragEvent<HTMLDivElement>, date: Date) => void;
    handleSlotClick: (date: Date, defaultHour: number) => void;
    handleDragStart: (e: React.DragEvent<HTMLDivElement>, apt: Appointment) => void;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
    setDraggedAppointment: React.Dispatch<React.SetStateAction<Appointment | null>>;
    setSelectedEvent: React.Dispatch<React.SetStateAction<Appointment | null>>;
}

export function CitasWeekView({
    selectedDate,
    setSelectedDate,
    visibleDays,
    setCalViewMode,
    getDay,
    isDragging,
    draggedAppointment,
    handleDragOver,
    handleDropWeek,
    handleSlotClick,
    handleDragStart,
    setIsDragging,
    setDraggedAppointment,
    setSelectedEvent,
}: CitasWeekViewProps) {
    const formatTimeOffset = (iso: string) => {
        return new Date(iso).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const weeklyAppointments = visibleDays.reduce((acc, day) => {
        return acc + getDay(day).filter((apt) => apt.status !== 'cancelled').length;
    }, 0);

    return (
        <div className="zc-week-view zc-week-view--clean flex-1 flex flex-col h-full overflow-hidden">
            <div className="zc-cal-head zc-cal-head--week">
                <button
                    type="button"
                    className="zc-cal-head__nav"
                    onClick={() => setSelectedDate((d) => subWeeks(d, 1))}
                    aria-label="Semana anterior"
                >
                    <Icon name="chevron-left" size={18} />
                </button>

                <div className="zc-cal-head__center">
                    <span className="zc-cal-head__kicker">Vista semanal</span>
                    <h2 className="zc-cal-head__title">
                        {format(visibleDays[0], 'd MMM', { locale: es })} - {format(visibleDays[6], 'd MMM yyyy', { locale: es })}
                    </h2>
                    <p className="zc-cal-head__meta">{weeklyAppointments} citas activas esta semana</p>
                </div>

                <button
                    type="button"
                    className="zc-cal-head__nav"
                    onClick={() => setSelectedDate((d) => addWeeks(d, 1))}
                    aria-label="Semana siguiente"
                >
                    <Icon name="chevron-right" size={18} />
                </button>
            </div>

            <div className="zc-week-grid flex-1 flex overflow-x-auto min-h-0 bg-[var(--bg-surface)] rounded-b-2xl">
                {visibleDays.map((day, i) => {
                    const dayApts = getDay(day).filter((a) => a.status !== 'cancelled');
                    const todayCol = isToday(day);
                    const selected = isSameDay(day, selectedDate);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    return (
                        <div
                            key={i}
                            className={`zc-week-col ${selected ? 'is-selected' : ''} ${todayCol ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDropWeek(e, day)}
                        >
                            <div
                                className="zc-week-col__head"
                                onClick={() => {
                                    setSelectedDate(day);
                                    setCalViewMode('day');
                                }}
                            >
                                <span className="zc-week-col__weekday">
                                    {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                                </span>
                                <strong className="zc-week-col__day">{day.getDate()}</strong>
                                <span className="zc-week-col__count">
                                    {dayApts.length} cita{dayApts.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            <div className="zc-week-col__body">
                                {dayApts.length === 0 ? (
                                    <button
                                        type="button"
                                        className="zc-week-empty"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSlotClick(day, 9);
                                        }}
                                    >
                                        <Icon name="plus" size={15} />
                                        Nueva cita
                                    </button>
                                ) : (
                                    dayApts.map((apt) => {
                                        const color = 'var(--text-main)';
                                        const itemStyle: React.CSSProperties & { '--event-color': string } = {
                                            borderLeftColor: color,
                                            '--event-color': color,
                                        };

                                        return (
                                            <div
                                                key={apt.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, apt)}
                                                onDragEnd={() => {
                                                    setIsDragging(false);
                                                    setDraggedAppointment(null);
                                                }}
                                                className={`zc-week-event is-${apt.status}
                                                    ${apt.status === 'cancelled' ? 'is-cancelled' : ''}
                                                    ${isDragging && draggedAppointment?.id === apt.id ? 'is-dragging' : ''}`}
                                                style={itemStyle}
                                                onClick={() => {
                                                    setSelectedDate(day);
                                                    setSelectedEvent(apt);
                                                }}
                                            >
                                                <span className="zc-week-event__time">
                                                    {formatTimeOffset(apt.start_time)} - {formatTimeOffset(apt.end_time)}
                                                </span>
                                                <strong className="zc-week-event__patient">{apt.patient_name || 'Paciente'}</strong>
                                                <span className="zc-week-event__service">{apt.service?.name || 'Cita general'}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
