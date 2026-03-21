import React from 'react';
import { subDays, addDays, isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from '@/components/Icon';
import type { Appointment } from '@/lib/types';

interface CitasDayViewProps {
    selectedDate: Date;
    setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
    timelineHeight: number;
    timelineStart: number;
    timelineEnd: number;
    nowPercent: number;
    today: Date;
    HOURS: number[];
    dayAppointments: Appointment[];
    isDragging: boolean;
    draggedAppointment: Appointment | null;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDropTimeline: (e: React.DragEvent<HTMLDivElement>, date: Date) => void;
    handleSlotClick: (date: Date, hour: number) => void;
    handleDragStart: (e: React.DragEvent<HTMLDivElement>, apt: Appointment) => void;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
    setDraggedAppointment: React.Dispatch<React.SetStateAction<Appointment | null>>;
    setSelectedEvent: React.Dispatch<React.SetStateAction<Appointment | null>>;
}

const STATUS_SHORT: Record<Appointment['status'], string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
};

export function CitasDayView({
    selectedDate,
    setSelectedDate,
    timelineHeight,
    timelineStart,
    timelineEnd,
    nowPercent,
    today,
    HOURS,
    dayAppointments,
    isDragging,
    draggedAppointment,
    handleDragOver,
    handleDropTimeline,
    handleSlotClick,
    handleDragStart,
    setIsDragging,
    setDraggedAppointment,
    setSelectedEvent,
}: CitasDayViewProps) {
    const totalTimelineMinutes = Math.max(1, timelineEnd - timelineStart);

    const formatTimeOffset = (iso: string) => {
        return new Date(iso).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getEventPosition = (apt: Appointment) => {
        const start = new Date(apt.start_time);
        const end = new Date(apt.end_time);
        const startMins = start.getHours() * 60 + start.getMinutes();
        const endMins = end.getHours() * 60 + end.getMinutes();
        const boundedStart = Math.max(timelineStart, Math.min(timelineEnd, startMins));
        const boundedEnd = Math.max(boundedStart + 20, Math.min(timelineEnd, endMins));

        let topPercent = ((boundedStart - timelineStart) / totalTimelineMinutes) * 100;
        let heightPercent = ((boundedEnd - boundedStart) / totalTimelineMinutes) * 100;

        topPercent = Math.max(0, Math.min(100, topPercent));
        if (topPercent + heightPercent > 100) {
            heightPercent = 100 - topPercent;
        }

        return {
            top: `${topPercent}%`,
            height: `${Math.max(2.2, heightPercent)}%`,
        };
    };

    const activeAppointments = dayAppointments.filter((apt) => apt.status !== 'cancelled').length;

    return (
        <div className="zc-day-view zc-day-view--clean flex-1 flex flex-col h-full overflow-hidden">
            <div className="zc-cal-head zc-cal-head--day">
                <button
                    type="button"
                    className="zc-cal-head__nav"
                    onClick={() => setSelectedDate((d) => subDays(d, 1))}
                    aria-label="Dia anterior"
                >
                    <Icon name="chevron-left" size={18} />
                </button>

                <div className="zc-cal-head__center">
                    <span className="zc-cal-head__kicker">
                        {isToday(selectedDate) ? 'Hoy' : format(selectedDate, 'EEEE', { locale: es })}
                    </span>
                    <h2 className="zc-cal-head__title">
                        {format(selectedDate, 'd MMMM yyyy', { locale: es })}
                    </h2>
                    <p className="zc-cal-head__meta">
                        {activeAppointments} activas | {dayAppointments.length} en total
                    </p>
                </div>

                <button
                    type="button"
                    className="zc-cal-head__nav"
                    onClick={() => setSelectedDate((d) => addDays(d, 1))}
                    aria-label="Dia siguiente"
                >
                    <Icon name="chevron-right" size={18} />
                </button>
            </div>

            <div className="zc-timeline zc-timeline--clean flex-1 overflow-y-auto relative p-4">
                <div
                    className="relative"
                    style={{ height: `${timelineHeight}px` }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropTimeline(e, selectedDate)}
                >
                    {isToday(selectedDate) && nowPercent > 0 && nowPercent < 100 && (
                        <div
                            className="zc-timeline__now absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                            style={{ top: `${nowPercent}%` }}
                        >
                            <div className="zc-timeline__now-dot" />
                            <div className="zc-timeline__now-line" />
                            <span className="zc-timeline__now-label">
                                {today.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )}

                    {HOURS.map((h) => (
                        <div
                            key={h}
                            className="zc-hour-row"
                            style={{
                                top: `${((h * 60 - timelineStart) / totalTimelineMinutes) * 100}%`,
                                height: `${(60 / totalTimelineMinutes) * 100}%`,
                            }}
                            onClick={() => handleSlotClick(selectedDate, h)}
                        >
                            <div className="zc-hour-row__label">{`${h.toString().padStart(2, '0')}:00`}</div>
                            <div className="zc-hour-row__lane" />
                        </div>
                    ))}

                    <div className="zc-timeline__events">
                        {(() => {
                            const sortedApts = [...dayAppointments].sort(
                                (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                            );

                            const columns: Appointment[][] = [];

                            sortedApts.forEach((apt) => {
                                let placed = false;
                                for (const col of columns) {
                                    const lastApt = col[col.length - 1];
                                    if (new Date(apt.start_time).getTime() >= new Date(lastApt.end_time).getTime()) {
                                        col.push(apt);
                                        placed = true;
                                        break;
                                    }
                                }
                                if (!placed) {
                                    columns.push([apt]);
                                }
                            });

                            return sortedApts.map((apt) => {
                                const pos = getEventPosition(apt);
                                const color = 'var(--text-main)';
                                const isCancelled = apt.status === 'cancelled';

                                const colIndex = columns.findIndex((col) => col.includes(apt));
                                const start = new Date(apt.start_time).getTime();
                                const end = new Date(apt.end_time).getTime();

                                let overlappingCount = 0;
                                columns.forEach((col) => {
                                    if (
                                        col.some(
                                            (a) =>
                                                new Date(a.start_time).getTime() < end &&
                                                new Date(a.end_time).getTime() > start
                                        )
                                    ) {
                                        overlappingCount++;
                                    }
                                });

                                const columnCount = Math.max(1, overlappingCount);
                                const widthNum = 100 / columnCount;
                                const leftNum = colIndex * widthNum;
                                const singleColumnInset = columnCount === 1 ? 2 : 0;
                                const durationMinutes = Math.max(
                                    0,
                                    Math.round((new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / 60000)
                                );
                                const compactEvent = durationMinutes < 75 || columnCount > 1;

                                const eventStyle: React.CSSProperties & { '--event-color': string } = {
                                    top: pos.top,
                                    left: columnCount === 1 ? `${singleColumnInset}%` : `${leftNum}%`,
                                    width:
                                        columnCount === 1
                                            ? `calc(${100 - singleColumnInset * 2}% - 4px)`
                                            : `calc(${widthNum}% - 4px)`,
                                    height: `calc(${pos.height} - 2px)`,
                                    borderLeftColor: color,
                                    '--event-color': color,
                                };

                                return (
                                    <div
                                        key={apt.id}
                                        draggable={!isCancelled}
                                        onDragStart={(e) => !isCancelled && handleDragStart(e, apt)}
                                        onDragEnd={() => {
                                            setIsDragging(false);
                                            setDraggedAppointment(null);
                                        }}
                                        className={`zc-day-event is-${apt.status}
                                            ${isCancelled ? 'is-cancelled' : ''}
                                            ${compactEvent ? 'is-compact' : ''}
                                            ${isDragging && draggedAppointment?.id === apt.id ? 'is-dragging' : ''}`}
                                        style={eventStyle}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedEvent(apt);
                                        }}
                                    >
                                        <div className="zc-day-event__top">
                                            <span className="zc-day-event__time">{formatTimeOffset(apt.start_time)}</span>
                                            <span className="zc-day-event__status">{STATUS_SHORT[apt.status]}</span>
                                        </div>

                                        <strong className="zc-day-event__patient">{apt.patient_name || 'Paciente'}</strong>
                                        {!compactEvent && (
                                            <span className="zc-day-event__service">{apt.service?.name || 'Cita general'}</span>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
