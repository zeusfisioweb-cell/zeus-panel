'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { addDays, format, isToday, startOfWeek, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from '@/components/Icon';
import type { Appointment, AppointmentStatus, Professional } from '@/lib/types';
import { isSameDay } from '@/lib/utils';
import '@/styles/theme/calendar-timeline.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CitasTimelineProps {
    appointments: Appointment[];
    professionals: Professional[];
    selectedDate: Date;
    setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
    openHour: number;
    closeHour: number;
    onSlotClick: (date: Date, professionalId: string | null) => void;
    onAppointmentClick: (appointment: Appointment) => void;
    onReschedule?: (id: string, newStart: Date, newEnd: Date) => void;
    isDraggable?: boolean;
}

interface PositionedAppointment {
    appointment: Appointment;
    topPx: number;
    heightPx: number;
    leftPct: number;
    widthPct: number;
    profColor: string;
    profName: string;
}

interface OverflowBadge {
    type: 'overflow';
    topPx: number;
    heightPx: number;
    count: number;
}

type PositionedItem = PositionedAppointment | OverflowBadge;

// ─── Constants ────────────────────────────────────────────────────────────────

const PX_PER_MIN        = 2.2;   // 13h × 60 × 2.2 = 1716px total height
const SLOT_MIN          = 30;
const MIN_DUR_MIN       = 30;
const MAX_VISIBLE_COLS  = 4;    // cap overlap columns to keep cards readable
const TIME_W       = 64;    // px width of the time rail
const UNASSIGNED_COLOR = '#94a3b8';


const STATUS_LABELS: Record<AppointmentStatus, string> = {
    pending:   'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
};

// Fallback palette if a professional has no color_code
const PALETTE = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#14b8a6','#ef4444','#6366f1'];

function minutesOf(d: Date) { return d.getHours() * 60 + d.getMinutes(); }

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(min: number) {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function initials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AppointmentCardProps {
    pos: PositionedAppointment;
    onAppointmentClick: (a: Appointment) => void;
    isDraggable?: boolean;
    onDragStart?: (e: React.DragEvent<HTMLDivElement>, pos: PositionedAppointment) => void;
    onDragEnd?: () => void;
}

const AppointmentCard = React.memo(({ pos, onAppointmentClick, isDraggable, onDragStart, onDragEnd }: AppointmentCardProps) => {
    const { appointment: apt, topPx, heightPx, leftPct, widthPct, profColor, profName } = pos;
    const isCompact  = heightPx < 44;
    const isTiny     = heightPx < 28;
    const rgb        = hexToRgb(profColor.startsWith('#') ? profColor : '#94a3b8');
    const patName    = apt.patient
        ? `${apt.patient.first_name} ${apt.patient.last_name}`
        : apt.patient_name ?? 'Paciente';
    const svcName    = apt.service?.name ?? '';
    const statusName = STATUS_LABELS[apt.status].toLowerCase();
    const ariaLabel  = `Abrir cita de ${patName}${svcName ? `, ${svcName}` : ''}, ${profName}, ${fmtTime(apt.start_time)}, ${statusName}`;

    return (
        <div
            className={`zc-vcal__event is-${apt.status}${isCompact ? ' is-compact' : ''}${isTiny ? ' is-tiny' : ''}${isDraggable ? ' is-draggable' : ''}`}
            role="button"
            tabIndex={0}
            draggable={isDraggable}
            style={{
                top:    `${topPx + 2}px`,
                height: `${Math.max(22, heightPx - 4)}px`,
                left:   `calc(${leftPct}% + 4px)`,
                width:  `calc(${widthPct}% - 8px)`,
                '--pc': profColor,
                '--pc-rgb': rgb,
                cursor: isDraggable ? 'grab' : 'pointer',
            } as React.CSSProperties}
            onClick={e => { e.stopPropagation(); onAppointmentClick(apt); }}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onAppointmentClick(apt);
                }
            }}
            onDragStart={isDraggable && onDragStart ? e => onDragStart(e, pos) : undefined}
            onDragEnd={isDraggable && onDragEnd ? onDragEnd : undefined}
            aria-label={ariaLabel}
            title={`${patName}${svcName ? ` · ${svcName}` : ''} — ${profName} (${fmtTime(apt.start_time)})`}
        >
            {!isTiny && (
                <div className="zc-vcal__evt-top">
                    <span className="zc-vcal__evt-time">
                        {fmtTime(apt.start_time)}
                        {(apt.service?.duration_minutes ?? apt.end_time) && (
                            <span className="zc-vcal__evt-dur"> · {fmtDuration(
                                apt.service?.duration_minutes ??
                                Math.round((new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / 60000)
                            )}</span>
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
            {!isCompact && svcName && (
                <p className="zc-vcal__evt-service">{svcName}</p>
            )}
            {!isCompact && heightPx >= 88 && (
                <p className="zc-vcal__evt-prof">{profName}</p>
            )}
        </div>
    );
});
AppointmentCard.displayName = 'AppointmentCard';

function snapMin(min: number, snap = 5) { return Math.round(min / snap) * snap; }

export function CitasTimeline({
    appointments,
    professionals,
    selectedDate,
    setSelectedDate,
    openHour,
    closeHour,
    onSlotClick,
    onAppointmentClick,
    onReschedule,
    isDraggable,
}: CitasTimelineProps) {
    const [profFilter,   setProfFilter]   = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | AppointmentStatus>('all');
    const scrollRef    = useRef<HTMLDivElement>(null);
    const animFrameRef = useRef<number>(0);
    const eventsAreaRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragInfoRef   = useRef<{ id: string; durationMin: number; offsetMin: number } | null>(null);
    const [containerWidth, setContainerWidth] = useState(1200);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect.width ?? el.offsetWidth;
            setContainerWidth(w);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const maxOverlapCols = containerWidth < 500 ? 2 : MAX_VISIBLE_COLS;
    const [dragOverMin, setDragOverMin]   = useState<number | null>(null);
    const [draggingOverDay, setDraggingOverDay] = useState<string | null>(null);

    const dayStart  = openHour  * 60;
    const dayEnd    = closeHour * 60;
    const totalMin  = Math.max(60, dayEnd - dayStart);
    const totalH    = totalMin  * PX_PER_MIN;

    // ── Professional color map ─────────────────────────────────────────────────
    const profColorMap = useMemo(() => {
        const m = new Map<string, string>();
        professionals.forEach((p, i) => {
            m.set(p.id, p.color_code || PALETTE[i % PALETTE.length]);
        });
        return m;
    }, [professionals]);

    const profNameMap = useMemo(() => {
        const m = new Map<string, string>();
        professionals.forEach(p => {
            m.set(p.id, p.profile?.full_name || 'Profesional');
        });
        // Fill gaps from appointments' own nested professional data
        appointments.forEach(a => {
            if (a.professional_id && !m.has(a.professional_id)) {
                const name = (a.professional as { profile?: { full_name?: string | null } } | null)?.profile?.full_name;
                if (name) m.set(a.professional_id, name);
            }
        });
        return m;
    }, [professionals, appointments]);

    // ── Week strip (7 days centered on today) ─────────────────────────────────
    const weekDays = useMemo(() => {
        const mon = startOfWeek(selectedDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    }, [selectedDate]);

    // ── Hour + slot marks ─────────────────────────────────────────────────────
    const hourMarks = useMemo(
        () => Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i),
        [openHour, closeHour]
    );
    const slotMarks = useMemo(() => {
        const m: number[] = [];
        for (let t = dayStart; t < dayEnd; t += SLOT_MIN) m.push(t);
        return m;
    }, [dayStart, dayEnd]);

    // ── Day appointments ──────────────────────────────────────────────────────
    const dayApts = useMemo(
        () => appointments.filter(a => isSameDay(new Date(a.start_time), selectedDate)),
        [appointments, selectedDate]
    );

    // ── Filtered ──────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return dayApts.filter(a => {
            if (profFilter !== 'all' && a.professional_id !== profFilter) return false;
            if (statusFilter === 'active') return a.status === 'confirmed';
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            return true;
        });
    }, [dayApts, profFilter, statusFilter]);

    // ── Status counts ─────────────────────────────────────────────────────────
    const counts = useMemo(() => dayApts.reduce<Partial<Record<AppointmentStatus, number>>>(
        (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; },
        { confirmed: 0, completed: 0, cancelled: 0 }
    ), [dayApts]);

    // ── Now indicator ─────────────────────────────────────────────────────────
    const nowTopPx = useMemo(() => {
        if (!isToday(selectedDate)) return null;
        const now = minutesOf(new Date());
        if (now < dayStart || now > dayEnd) return null;
        return (now - dayStart) * PX_PER_MIN;
    }, [selectedDate, dayStart, dayEnd]);

    // Live now-line: update every minute
    const [, forceRender] = useState(0);
    useEffect(() => {
        if (!isToday(selectedDate)) return;
        const id = setInterval(() => forceRender(n => n + 1), 60_000);
        return () => clearInterval(id);
    }, [selectedDate]);

    // Auto-scroll to now on mount / date change
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const target = nowTopPx !== null ? Math.max(0, nowTopPx - 140) : 0;
        animFrameRef.current = requestAnimationFrame(() => { el.scrollTop = target; });
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [nowTopPx, selectedDate]);

    // ── Overlap-aware positioning ─────────────────────────────────────────────
    const positioned = useMemo<PositionedItem[]>(() => {
        // maxOverlapCols captured in closure so the memo re-runs on resize
        const cap = maxOverlapCols;
        interface N { apt: Appointment; startM: number; endM: number; }
        const norm: N[] = filtered
            .map(apt => {
                const s = minutesOf(new Date(apt.start_time));
                const e = minutesOf(new Date(apt.end_time));
                const startM = Math.max(dayStart, Math.min(dayEnd, s));
                const endM   = Math.max(startM + MIN_DUR_MIN, Math.min(dayEnd, e));
                return { apt, startM, endM };
            })
            .sort((a, b) => a.startM - b.startM);

        // group into clusters of overlapping events
        const clusters: N[][] = [];
        norm.forEach(ev => {
            const last = clusters[clusters.length - 1];
            if (!last || ev.startM >= Math.max(...last.map(x => x.endM))) {
                clusters.push([ev]);
            } else {
                last.push(ev);
            }
        });

        const result: PositionedItem[] = [];
        clusters.forEach(cluster => {
            // Assign columns within cluster using greedy lane algorithm
            const lanes: number[] = []; // lane → endM
            const laneOf: number[] = new Array(cluster.length);

            cluster.forEach((ev, idx) => {
                let lane = lanes.findIndex(end => end <= ev.startM);
                if (lane === -1) { lane = lanes.length; lanes.push(ev.endM); }
                else { lanes[lane] = ev.endM; }
                laneOf[idx] = lane;
            });

            // Cap visible columns so cards stay readable on mobile
            const totalLanes = Math.min(lanes.length, cap);
            let overflowCount = 0;
            let overflowTopPx = 0;
            let overflowHeightPx = 0;

            cluster.forEach((ev, idx) => {
                const lane = laneOf[idx];
                if (lane >= cap) {
                    overflowCount++;
                    overflowTopPx    = (ev.startM - dayStart) * PX_PER_MIN;
                    overflowHeightPx = Math.max(MIN_DUR_MIN, ev.endM - ev.startM) * PX_PER_MIN;
                    return;
                }
                const profColor = ev.apt.professional_id
                    ? (profColorMap.get(ev.apt.professional_id) ?? UNASSIGNED_COLOR)
                    : UNASSIGNED_COLOR;
                const profName = ev.apt.professional_id
                    ? (profNameMap.get(ev.apt.professional_id) ?? 'Sin asignar')
                    : 'Sin asignar';

                result.push({
                    appointment: ev.apt,
                    topPx:     (ev.startM - dayStart) * PX_PER_MIN,
                    heightPx:  Math.max(MIN_DUR_MIN, ev.endM - ev.startM) * PX_PER_MIN,
                    leftPct:   (lane / totalLanes) * 100,
                    widthPct:  (1 / totalLanes) * 100,
                    profColor,
                    profName,
                });
            });

            if (overflowCount > 0) {
                result.push({
                    type: 'overflow',
                    topPx:    overflowTopPx,
                    heightPx: overflowHeightPx,
                    count:    overflowCount,
                });
            }
        });

        return result;
    }, [filtered, dayStart, dayEnd, profColorMap, profNameMap, maxOverlapCols]);

    const onSlot = useCallback((min: number) => {
        const d = new Date(selectedDate);
        d.setHours(Math.floor(min / 60), min % 60, 0, 0);
        onSlotClick(d, profFilter !== 'all' ? profFilter : null);
    }, [selectedDate, onSlotClick, profFilter]);

    const handleCardDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, pos: PositionedAppointment) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetPx = e.clientY - rect.top;
        const offsetMin = Math.round(offsetPx / PX_PER_MIN);
        const startM = minutesOf(new Date(pos.appointment.start_time));
        const endM   = minutesOf(new Date(pos.appointment.end_time));
        const durationMin = Math.max(15, endM - startM);
        dragInfoRef.current = { id: pos.appointment.id, durationMin, offsetMin };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pos.appointment.id);
    }, []);

    const handleCardDragEnd = useCallback(() => {
        dragInfoRef.current = null;
        setDragOverMin(null);
        setDraggingOverDay(null);
    }, []);

    const handleEventsAreaDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (!dragInfoRef.current || !eventsAreaRef.current || !onReschedule) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = eventsAreaRef.current.getBoundingClientRect();
        const rawMin = (e.clientY - rect.top) / PX_PER_MIN + dayStart - dragInfoRef.current.offsetMin;
        const clamped = Math.max(dayStart, Math.min(dayEnd - dragInfoRef.current.durationMin, rawMin));
        setDragOverMin(snapMin(clamped));
    }, [dayStart, dayEnd, onReschedule]);

    const handleEventsAreaDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!dragInfoRef.current || dragOverMin === null || !onReschedule) return;
        const { id, durationMin } = dragInfoRef.current;
        const newStart = new Date(selectedDate);
        newStart.setHours(Math.floor(dragOverMin / 60), dragOverMin % 60, 0, 0);
        const newEnd = new Date(newStart.getTime() + durationMin * 60_000);
        dragInfoRef.current = null;
        setDragOverMin(null);
        onReschedule(id, newStart, newEnd);
    }, [dragOverMin, selectedDate, onReschedule]);

    const handleWeekDayDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>, dayIso: string) => {
        if (!dragInfoRef.current || !onReschedule) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDraggingOverDay(dayIso);
    }, [onReschedule]);

    const handleWeekDayDrop = useCallback((e: React.DragEvent<HTMLButtonElement>, day: Date) => {
        e.preventDefault();
        if (!dragInfoRef.current || !onReschedule) return;
        const apt = appointments.find(a => a.id === dragInfoRef.current!.id);
        if (!apt) return;
        const origStart = new Date(apt.start_time);
        const origEnd   = new Date(apt.end_time);
        const newStart  = new Date(day);
        newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
        const newEnd = new Date(newStart.getTime() + (origEnd.getTime() - origStart.getTime()));
        dragInfoRef.current = null;
        setDraggingOverDay(null);
        onReschedule(apt.id, newStart, newEnd);
    }, [appointments, onReschedule]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="zc-vcal" ref={containerRef}>

            {/* ── Header ── */}
            <header className="zc-vcal__header">
                <div className="zc-vcal__header-top">
                    <div className="zc-vcal__heading">
                        <span className="zc-vcal__eyebrow">Agenda Clínica</span>
                        <h2 className="zc-vcal__date-title">
                            {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
                        </h2>
                    </div>

                    <div className="zc-vcal__controls">
                        <label className="zc-vcal__filter">
                            <span>Profesional</span>
                            <select value={profFilter} onChange={e => setProfFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                {professionals.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.profile?.full_name || 'Profesional'}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="zc-vcal__filter">
                            <span>Estado</span>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                                <option value="all">Todos</option>
                                <option value="active">Activas</option>
                                <option value="confirmed">Confirmadas</option>
                                <option value="completed">Completadas</option>
                                <option value="cancelled">Canceladas</option>
                            </select>
                        </label>

                        <nav className="zc-vcal__nav" aria-label="Navegación de fechas">
                            <button type="button" onClick={() => setSelectedDate(d => subDays(d, 1))} aria-label="Día anterior">
                                <Icon name="chevron-left" size={15} />
                            </button>
                            <button type="button" onClick={() => setSelectedDate(d => addDays(d, 1))} aria-label="Día siguiente">
                                <Icon name="chevron-right" size={15} />
                            </button>
                        </nav>

                        {!isToday(selectedDate) && (
                            <button type="button" className="zc-vcal__btn-today" onClick={() => setSelectedDate(new Date())}>
                                Hoy
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Status metrics ── */}
                <div className="zc-vcal__metrics">
                    <div className="zc-vcal__metric">
                        <span>Total</span>
                        <strong>{dayApts.length}</strong>
                    </div>
                    <div className="zc-vcal__metric is-confirmed">
                        <span>Confirmadas</span>
                        <strong>{counts.confirmed ?? 0}</strong>
                    </div>
                    <div className="zc-vcal__metric is-muted">
                        <span>Completadas</span>
                        <strong>{counts.completed}</strong>
                    </div>
                    {(counts.cancelled ?? 0) > 0 && (
                        <div className="zc-vcal__metric is-cancelled">
                            <span>Canceladas</span>
                            <strong>{counts.cancelled ?? 0}</strong>
                        </div>
                    )}
                </div>
            </header>

            {/* ── Week strip ── */}
            <div className="zc-vcal__week-strip">
                {weekDays.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrent  = isToday(day);
                    const cnt = appointments.filter(a => isSameDay(new Date(a.start_time), day)).length;
                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            className={`zc-vcal__week-day${isSelected ? ' is-selected' : ''}${isCurrent ? ' is-today' : ''}${draggingOverDay === day.toISOString() ? ' is-drag-over' : ''}`}
                            onClick={() => setSelectedDate(day)}
                            onDragOver={isDraggable ? e => handleWeekDayDragOver(e, day.toISOString()) : undefined}
                            onDragLeave={isDraggable ? () => setDraggingOverDay(null) : undefined}
                            onDrop={isDraggable ? e => handleWeekDayDrop(e, day) : undefined}
                        >
                            <span className="zc-vcal__wday-name">{format(day, 'EEE', { locale: es })}</span>
                            <span className="zc-vcal__wday-num">{format(day, 'd')}</span>
                            {cnt > 0 && <span className="zc-vcal__wday-dot">{cnt}</span>}
                        </button>
                    );
                })}
            </div>

            {/* ── Professional legend ── */}
            {professionals.length > 0 && (
                <div className="zc-vcal__legend">
                    {professionals.map((p, i) => {
                        const color = p.color_code || PALETTE[i % PALETTE.length];
                        const active = profFilter === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                className={`zc-vcal__legend-item${active ? ' is-active' : ''}`}
                                style={{ '--lc': color } as React.CSSProperties}
                                onClick={() => setProfFilter(profFilter === p.id ? 'all' : p.id)}
                                title={`Filtrar: ${p.profile?.full_name}`}
                            >
                                <span className="zc-vcal__legend-dot" />
                                <span className="zc-vcal__legend-name">
                                    {initials(p.profile?.full_name || 'P')}
                                    {' · '}
                                    {p.profile?.full_name || 'Profesional'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Calendar body ── */}
            <div className="zc-vcal__body" ref={scrollRef}>
                <div className="zc-vcal__inner" style={{ height: `${totalH}px` }}>

                    {/* Time rail (sticky left) */}
                    <div className="zc-vcal__time-rail" style={{ width: `${TIME_W}px`, minWidth: `${TIME_W}px`, height: `${totalH}px` }}>
                        {hourMarks.map(h => (
                            <div
                                key={h}
                                className="zc-vcal__hour"
                                style={{ top: `${(h * 60 - dayStart) * PX_PER_MIN}px` }}
                            >
                                <span>{h.toString().padStart(2, '0')}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Events area */}
                    <div
                        className="zc-vcal__events-area"
                        style={{ height: `${totalH}px` }}
                        ref={eventsAreaRef}
                        onDragOver={isDraggable ? handleEventsAreaDragOver : undefined}
                        onDragLeave={isDraggable ? () => setDragOverMin(null) : undefined}
                        onDrop={isDraggable ? handleEventsAreaDrop : undefined}
                    >

                        {/* Hour grid lines */}
                        {hourMarks.map(h => (
                            <div
                                key={`hl-${h}`}
                                className="zc-vcal__hline"
                                style={{ top: `${(h * 60 - dayStart) * PX_PER_MIN}px` }}
                            />
                        ))}

                        {/* Half-hour dashed lines */}
                        {slotMarks.filter(m => m % 60 !== 0).map(m => (
                            <div
                                key={`hh-${m}`}
                                className="zc-vcal__hline zc-vcal__hline--half"
                                style={{ top: `${(m - dayStart) * PX_PER_MIN}px` }}
                            />
                        ))}

                        {/* Clickable slots */}
                        {slotMarks.map(m => (
                            <button
                                key={`slot-${m}`}
                                type="button"
                                className="zc-vcal__slot"
                                style={{ top: `${(m - dayStart) * PX_PER_MIN}px`, height: `${SLOT_MIN * PX_PER_MIN}px` }}
                                onClick={() => onSlot(m)}
                                aria-label={`Crear cita a las ${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`}
                            />
                        ))}

                        {/* Now indicator */}
                        {nowTopPx !== null && (
                            <div className="zc-vcal__now" style={{ top: `${nowTopPx}px` }}>
                                <div className="zc-vcal__now-dot" />
                                <div className="zc-vcal__now-line" />
                            </div>
                        )}

                        {/* Drag-drop preview line */}
                        {dragOverMin !== null && (
                            <div
                                className="zc-vcal__drag-preview"
                                style={{ top: `${(dragOverMin - dayStart) * PX_PER_MIN}px` }}
                                aria-hidden="true"
                            >
                                <span className="zc-vcal__drag-preview-time">
                                    {`${Math.floor(dragOverMin / 60).toString().padStart(2, '0')}:${(dragOverMin % 60).toString().padStart(2, '0')}`}
                                </span>
                            </div>
                        )}

                        {/* Empty state */}
                        {filtered.length === 0 && (
                            <div className="zc-vcal__empty">
                                <Icon name="calendar" size={28} />
                                <p>Sin citas para este día</p>
                                <p style={{ fontSize: '12px', fontWeight: 500 }}>
                                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                                </p>
                            </div>
                        )}

                        {/* Appointments */}
                        {positioned.map((item, i) => {
                            if ('type' in item && item.type === 'overflow') {
                                return (
                                    <div
                                        key={`overflow-${i}`}
                                        className="zc-vcal__overflow"
                                        style={{ top: `${item.topPx + 2}px`, height: `${Math.max(22, item.heightPx - 4)}px` }}
                                        title="Filtra por profesional para ver todas las citas"
                                    >
                                        +{item.count}
                                    </div>
                                );
                            }
                            const pos = item as PositionedAppointment;
                            return (
                                <AppointmentCard
                                    key={pos.appointment.id}
                                    pos={pos}
                                    onAppointmentClick={onAppointmentClick}
                                    isDraggable={isDraggable}
                                    onDragStart={handleCardDragStart}
                                    onDragEnd={handleCardDragEnd}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="zc-vcal__footer">
                <span>{filtered.length} cita{filtered.length !== 1 ? 's' : ''}</span>
                <span>{professionals.length} profesional{professionals.length !== 1 ? 'es' : ''}</span>
                <span>{format(selectedDate, 'dd MMM yyyy', { locale: es })}</span>
            </footer>
        </div>
    );
}

export default CitasTimeline;
