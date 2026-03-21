'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import { toast } from 'sonner';

import type { ScheduleSlot, ScheduleException } from '@/lib/types';
import { DAY_NAMES, toDbDayOfWeek, toUiDayOfWeek } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';

interface ProfessionalOption {
    id: string;
    profile: { full_name: string } | null;
}

export default function HorariosPage() {
    const [supabase] = useState(() => createClient());
    const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
    const [selectedPro, setSelectedPro] = useState<string>('');
    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
    const [loading, setLoading] = useState(true);

    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const [newSlot, setNewSlot] = useState({ day_of_week: 0, start_time: '09:30', end_time: '14:00' });
    const [newException, setNewException] = useState({ start_date: '', end_date: '', reason: '', is_available: false });

    const loadProfessionals = useCallback(async () => {
        const { data } = await supabase
            .from('professionals')
            .select('id, profile:profiles(full_name)')
            .eq('is_active', true);

        setProfessionals((data as unknown as ProfessionalOption[]) || []);
        if (data && data.length > 0) setSelectedPro(data[0].id);
        setLoading(false);
    }, [supabase]);

    const loadSchedule = useCallback(async () => {
        if (!selectedPro) return;

        const [slotsRes, excRes] = await Promise.all([
            supabase.from('schedule_slots')
                .select('*')
                .eq('professional_id', selectedPro)
                .order('day_of_week')
                .order('start_time'),
            supabase.from('schedule_exceptions')
                .select('*')
                .eq('professional_id', selectedPro)
                .gte('exception_date', new Date().toISOString().split('T')[0])
                .order('exception_date'),
        ]);

        setSlots((slotsRes.data as ScheduleSlot[]) || []);
        setExceptions((excRes.data as ScheduleException[]) || []);
    }, [selectedPro, supabase]);

    useEffect(() => {
        loadProfessionals();
    }, [loadProfessionals]);

    useEffect(() => {
        if (selectedPro) loadSchedule();
    }, [selectedPro, loadSchedule]);

    async function addSlot() {
        if (!selectedPro) {
            toast.warning('Selecciona un profesional');
            return;
        }

        if (newSlot.start_time >= newSlot.end_time) {
            toast.warning('La hora de inicio debe ser anterior a la hora de fin');
            return;
        }

        const { error } = await supabase.from('schedule_slots').insert({
            professional_id: selectedPro,
            day_of_week: toDbDayOfWeek(newSlot.day_of_week),
            start_time: newSlot.start_time,
            end_time: newSlot.end_time,
        });

        if (error) {
            toast.error('Error al anadir franja: ' + error.message);
            return;
        }

        toast.success('Franja anadida');
        loadSchedule();
    }

    async function deleteSlot(id: string) {
        const { error } = await supabase.from('schedule_slots').delete().eq('id', id);
        if (error) {
            toast.error('Error al eliminar franja: ' + error.message);
            return;
        }
        toast.success('Franja eliminada');
        loadSchedule();
    }

    async function addException() {
        if (!selectedPro) {
            toast.warning('Selecciona un profesional');
            return;
        }

        if (!newException.start_date) {
            toast.warning('Selecciona una fecha de inicio');
            return;
        }

        const start = new Date(newException.start_date);
        const end = newException.end_date ? new Date(newException.end_date) : new Date(start);

        if (end < start) {
            toast.warning('La fecha de fin debe ser igual o posterior a la fecha de inicio');
            return;
        }

        const payload = [];
        const current = new Date(start);

        while (current <= end) {
            payload.push({
                professional_id: selectedPro,
                exception_date: current.toISOString().split('T')[0],
                reason: newException.reason,
                is_available: newException.is_available,
            });
            current.setDate(current.getDate() + 1);
        }

        const { error } = await supabase.from('schedule_exceptions').insert(payload);

        if (error) {
            toast.error('Error al anadir excepcion: ' + error.message);
            return;
        }

        toast.success(payload.length > 1 ? `${payload.length} excepciones anadidas` : 'Excepcion anadida');
        setNewException({ start_date: '', end_date: '', reason: '', is_available: false });
        loadSchedule();
    }

    async function deleteException(id: string) {
        const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id);
        if (error) {
            toast.error('Error al eliminar excepcion: ' + error.message);
            return;
        }
        toast.success('Excepcion eliminada');
        loadSchedule();
    }

    async function addPresetForDay(dayIndex: number) {
        if (!selectedPro) {
            toast.warning('Selecciona un profesional');
            return;
        }

        const payload = [
            {
                professional_id: selectedPro,
                day_of_week: toDbDayOfWeek(dayIndex),
                start_time: '09:30',
                end_time: '14:00',
            },
            {
                professional_id: selectedPro,
                day_of_week: toDbDayOfWeek(dayIndex),
                start_time: '15:00',
                end_time: '20:00',
            },
        ];

        const { error } = await supabase.from('schedule_slots').insert(payload);
        if (error) {
            toast.error('Error al crear horario del dia: ' + error.message);
            return;
        }

        toast.success(`Horario base anadido para ${DAY_NAMES[dayIndex]}`);
        loadSchedule();
    }

    function applyDefaultSchedule() {
        setConfirmAction({
            title: 'Aplicar horario base',
            message: 'Aplicar horario base (L-V 9:30-14:00, 15:00-20:00)? Se eliminaran las franjas actuales.',
            onConfirm: async () => {
                setConfirmAction(null);

                const { error: delError } = await supabase
                    .from('schedule_slots')
                    .delete()
                    .eq('professional_id', selectedPro);

                if (delError) {
                    toast.error('Error al limpiar horarios anteriores: ' + delError.message);
                    return;
                }

                const defaultSlots = [];
                for (let day = 0; day <= 4; day++) {
                    defaultSlots.push(
                        { professional_id: selectedPro, day_of_week: toDbDayOfWeek(day), start_time: '09:30', end_time: '14:00' },
                        { professional_id: selectedPro, day_of_week: toDbDayOfWeek(day), start_time: '15:00', end_time: '20:00' },
                    );
                }

                const { error: insError } = await supabase.from('schedule_slots').insert(defaultSlots);
                if (insError) {
                    toast.error('Error al crear franjas base: ' + insError.message);
                    return;
                }

                toast.success('Horario base aplicado correctamente');
                loadSchedule();
            },
        });
    }

    if (loading) {
        return (
            <div className="flex justify-center p-15">
                <div className="spinner" />
            </div>
        );
    }

    const slotsByDay = DAY_NAMES.map((name, i) => ({
        name,
        dayIndex: i,
        slots: slots.filter((slot) => toUiDayOfWeek(slot.day_of_week) === i),
    }));
    const weeklySlotCount = slots.length;
    const activeDays = slotsByDay.filter((day) => day.slots.length > 0).length;

    return (
        <div className="content-shell schedule-shell">
            <header className="module-header module-header--schedule">
                <div>
                    <span className="module-header__kicker">Agenda</span>
                    <h1 className="module-header__title">Horarios</h1>
                    <p className="module-header__desc">
                        Define disponibilidad semanal y bloqueos puntuales por profesional.
                    </p>
                    <p className="module-header__meta">
                        {weeklySlotCount} franjas activas | {activeDays}/7 dias con agenda | {exceptions.length} excepciones futuras
                    </p>
                </div>
                <div className="module-header__actions schedule-header__actions">
                    <label className="schedule-picker">
                        <span className="schedule-picker__label">Profesional</span>
                        <select
                            className="form-input form-select schedule-picker__control"
                            value={selectedPro}
                            onChange={(e) => setSelectedPro(e.target.value)}
                        >
                            {professionals.map((p) => (
                                <option key={p.id} value={p.id}>{p.profile?.full_name || 'Profesional'}</option>
                            ))}
                        </select>
                    </label>
                    <button className="btn btn--secondary schedule-header__button" onClick={applyDefaultSchedule}>
                        <Icon name="refresh-cw" size={14} />
                        Aplicar horario base
                    </button>
                </div>
            </header>

            <div className="schedule-grid">
                <section className="card schedule-card">
                    <div className="card__header schedule-card__header">
                        <h2 className="card__title">Disponibilidad semanal</h2>
                        <p className="schedule-card__hint">Gestiona franjas por dia para construir el calendario base del profesional.</p>
                    </div>

                    <div className="card__body schedule-day-list">
                        {slotsByDay.map((day) => (
                            <article
                                key={day.dayIndex}
                                className={`schedule-day ${day.slots.length > 0 ? '' : 'is-empty'}`}
                            >
                                <div className="schedule-day__head">
                                    <h3 className="schedule-day__name">{day.name}</h3>
                                    <span className="schedule-day__count">
                                        {day.slots.length === 0 ? 'Sin franjas' : `${day.slots.length} franja${day.slots.length > 1 ? 's' : ''}`}
                                    </span>
                                </div>
                                <div className="schedule-day__slots">
                                    {day.slots.length === 0 ? (
                                        <div className="schedule-day__empty-box">
                                            <span className="schedule-day__empty">Dia sin disponibilidad</span>
                                            <button
                                                className="btn btn--ghost btn--sm schedule-day__quick-add"
                                                onClick={() => addPresetForDay(day.dayIndex)}
                                            >
                                                <Icon name="plus" size={12} />
                                                Crear horario
                                            </button>
                                        </div>
                                    ) : (
                                        day.slots.map((slot) => (
                                            <div key={slot.id} className="schedule-slot-chip">
                                                <span>{slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}</span>
                                                <button
                                                    onClick={() => deleteSlot(slot.id)}
                                                    className="schedule-slot-chip__remove"
                                                    aria-label="Eliminar franja"
                                                >
                                                    <Icon name="close" size={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="card__body schedule-slot-builder">
                        <h3 className="schedule-slot-builder__title">Anadir franja manual</h3>
                        <div className="schedule-slot-builder__form">
                            <div className="form-group">
                                <label className="form-label">Dia</label>
                                <select
                                    className="form-input form-select"
                                    value={newSlot.day_of_week}
                                    onChange={(e) => setNewSlot({ ...newSlot, day_of_week: +e.target.value })}
                                >
                                    {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Desde</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={newSlot.start_time}
                                    onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hasta</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={newSlot.end_time}
                                    onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                                />
                            </div>
                            <button className="btn btn--primary schedule-slot-builder__submit" onClick={addSlot}>
                                <Icon name="plus" size={14} />
                                Anadir franja
                            </button>
                        </div>
                    </div>
                </section>

                <section className="card schedule-card schedule-card--exceptions">
                    <div className="card__header schedule-card__header">
                        <h2 className="card__title">Bloqueos y excepciones</h2>
                        <p className="schedule-card__hint">Registra dias libres o aperturas extra sin tocar el horario semanal.</p>
                    </div>
                    <div className="card__body schedule-exception-list">
                        {exceptions.length === 0 ? (
                            <div className="schedule-empty">
                                <Icon name="calendar" size={18} />
                                <p>No hay excepciones programadas</p>
                            </div>
                        ) : (
                            <div className="schedule-exception-items">
                                {exceptions.map((ex) => (
                                    <article key={ex.id} className={`schedule-exception-item ${ex.is_available ? 'is-available' : 'is-blocked'}`}>
                                        <div className="schedule-exception-item__content">
                                            <div className="schedule-exception-item__date">
                                                {new Date(ex.exception_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            {ex.reason && <div className="schedule-exception-item__reason">{ex.reason}</div>}
                                        </div>
                                        <div className="schedule-exception-item__actions">
                                            <span className={`badge ${ex.is_available ? 'badge--confirmed' : 'badge--warning'}`}>
                                                {ex.is_available ? 'Disponible' : 'No disponible'}
                                            </span>
                                            <button
                                                onClick={() => deleteException(ex.id)}
                                                className="schedule-exception-item__remove"
                                                aria-label="Eliminar excepcion"
                                            >
                                                <Icon name="close" size={12} />
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        <div className="schedule-exception-builder">
                            <h3 className="schedule-exception-builder__title">Nueva excepcion</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Desde</label>
                                    <input type="date" className="form-input" value={newException.start_date} onChange={(e) => setNewException({ ...newException, start_date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hasta (opcional)</label>
                                    <input type="date" className="form-input" value={newException.end_date} onChange={(e) => setNewException({ ...newException, end_date: e.target.value })} min={newException.start_date} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Motivo</label>
                                <input className="form-input" placeholder="Ej: Vacaciones" value={newException.reason} onChange={(e) => setNewException({ ...newException, reason: e.target.value })} />
                            </div>

                            <div className="form-group schedule-exception-builder__checkbox">
                                <label className="form-checkbox-label">
                                    <input type="checkbox" checked={newException.is_available} onChange={(e) => setNewException({ ...newException, is_available: e.target.checked })} />
                                    <span>Disponibilidad extra (no dia libre)</span>
                                </label>
                            </div>

                            <button className="btn btn--primary schedule-exception-builder__submit" onClick={addException}>
                                <Icon name="plus" size={14} />
                                Anadir excepcion
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    variant="warning"
                    confirmLabel="Aplicar"
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
}
