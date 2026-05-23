'use client';

import React from 'react';
import type { Appointment } from '@/lib/types';
import { STATUS_LABELS } from './constants';
import type { PositionedAppointment } from './types';
import { fmtTime, fmtDuration, hexToRgb } from './utils';

interface AppointmentCardProps {
    pos: PositionedAppointment;
    onAppointmentClick: (a: Appointment) => void;
    isDraggable?: boolean;
    onDragStart?: (e: React.DragEvent<HTMLDivElement>, pos: PositionedAppointment) => void;
    onDragEnd?: () => void;
}

export const AppointmentCard = React.memo(
    ({ pos, onAppointmentClick, isDraggable, onDragStart, onDragEnd }: AppointmentCardProps) => {
        const { appointment: apt, topPx, heightPx, leftPct, widthPct, profColor, profName } = pos;
        const isCompact = heightPx < 44;
        const isTiny = heightPx < 28;
        const rgb = hexToRgb(profColor.startsWith('#') ? profColor : '#94a3b8');
        const patName = apt.patient
            ? `${apt.patient.first_name} ${apt.patient.last_name}`
            : apt.patient_name ?? 'Paciente';
        const svcName = apt.service?.name ?? '';
        const statusName = STATUS_LABELS[apt.status].toLowerCase();
        const ariaLabel = `Abrir cita de ${patName}${svcName ? `, ${svcName}` : ''}, ${profName}, ${fmtTime(apt.start_time)}, ${statusName}`;

        return (
            <div
                className={`zc-vcal__event is-${apt.status}${isCompact ? ' is-compact' : ''}${isTiny ? ' is-tiny' : ''}${isDraggable ? ' is-draggable' : ''}`}
                role="button"
                tabIndex={0}
                draggable={isDraggable}
                style={{
                    top: `${topPx + 2}px`,
                    height: `${Math.max(22, heightPx - 4)}px`,
                    left: `calc(${leftPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                    '--pc': profColor,
                    '--pc-rgb': rgb,
                    cursor: isDraggable ? 'grab' : 'pointer',
                } as React.CSSProperties}
                onClick={(e) => {
                    e.stopPropagation();
                    onAppointmentClick(apt);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onAppointmentClick(apt);
                    }
                }}
                onDragStart={isDraggable && onDragStart ? (e) => onDragStart(e, pos) : undefined}
                onDragEnd={isDraggable && onDragEnd ? onDragEnd : undefined}
                aria-label={ariaLabel}
                title={`${patName}${svcName ? ` · ${svcName}` : ''} — ${profName} (${fmtTime(apt.start_time)})`}
            >
                {!isTiny && (
                    <div className="zc-vcal__evt-top">
                        <span className="zc-vcal__evt-time">
                            {fmtTime(apt.start_time)}
                            {(apt.service?.duration_minutes ?? apt.end_time) && (
                                <span className="zc-vcal__evt-dur">
                                    {' · '}
                                    {fmtDuration(
                                        apt.service?.duration_minutes ??
                                            Math.round(
                                                (new Date(apt.end_time).getTime() -
                                                    new Date(apt.start_time).getTime()) /
                                                    60000
                                            )
                                    )}
                                </span>
                            )}
                        </span>
                        {!isCompact && (
                            <span className={`zc-vcal__evt-badge is-${apt.status}`}>
                                {STATUS_LABELS[apt.status]}
                            </span>
                        )}
                    </div>
                )}
                <p className="zc-vcal__evt-patient">{patName}</p>
                {!isCompact && svcName && <p className="zc-vcal__evt-service">{svcName}</p>}
                {!isCompact && heightPx >= 88 && <p className="zc-vcal__evt-prof">{profName}</p>}
            </div>
        );
    }
);
AppointmentCard.displayName = 'AppointmentCard';
