'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/Icon';
import ConfirmModal from '@/components/ConfirmModal';

import { DAY_NAMES, toDbDayOfWeek, toUiDayOfWeek } from '@/lib/types';
import { useProfesionales } from '@/hooks/useProfesionales';
import {
    useHorario,
    useCreateSlot,
    useDeleteSlot,
    useCreateException,
    useDeleteException,
    useApplyDefaultSchedule,
} from '@/hooks/useHorarios';

export default function HorariosPage() {
    const { data: professionalsData, isLoading: isLoadingProfs } = useProfesionales();
    const [selectedPro, setSelectedPro] = useState('');

    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const [newSlot, setNewSlot] = useState({ day_of_week: 0, start_time: '09:30', end_time: '14:00' });
    const [newException, setNewException] = useState({ start_date: '', end_date: '', reason: '', is_available: false });

    const professionals = (professionalsData || [])
        .filter((pro) => pro.is_active)
        .map((pro) => ({
            id: pro.id,
            profile: pro.profile,
        }));

    useEffect(() => {
        if (!selectedPro && professionals.length > 0) {
            setSelectedPro(professionals[0].id);
        }
    }, [professionals, selectedPro]);

    const { data: horarioData, isLoading: isLoadingHorario } = useHorario(selectedPro || null);
    const slots = horarioData?.slots || [];
    const exceptions = horarioData?.exceptions || [];

    const createSlotM = useCreateSlot();
    const deleteSlotM = useDeleteSlot();
    const createExceptionM = useCreateException();
    const deleteExceptionM = useDeleteException();
    const applyDefaultM = useApplyDefaultSchedule();

    const isLoading = isLoadingProfs || isLoadingHorario;

    const getErrorMessage = (error: unknown): string => {
        if (typeof error === 'object' && error !== null) {
            const withIssues = error as { issues?: Array<{ message?: string }> };
            if (Array.isArray(withIssues.issues) && withIssues.issues[0]?.message) {
                return withIssues.issues[0].message || 'Error desconocido';
            }
        }

        if (error instanceof Error) {
            return error.message;
        }

        return 'Error desconocido';
    };

    async function addSlot() {
        if (!selectedPro) {
            toast.warning('Selecciona un profesional');
            return;
        }

        try {
            await createSlotM.mutateAsync({
                professional_id: selectedPro,
                day_of_week: toDbDayOfWeek(newSlot.day_of_week),
                start_time: newSlot.start_time,
                end_time: newSlot.end_time,
            });
            toast.success('Franja añadida');
        } catch (error: unknown) {
             toast.error(`Error al añadir franja: ${getErrorMessage(error)}`);
        }
    }

    async function deleteSlot(id: string) {
        try {
            await deleteSlotM.mutateAsync({ id, professional_id: selectedPro });
            toast.success('Franja eliminada');
        } catch (error: unknown) {
            toast.error(`Error al eliminar franja: ${getErrorMessage(error)}`);
        }
    }

    async function addException() {
        if (!selectedPro) {
            toast.warning('Selecciona un profesional');
            return;
        }

        try {
            await createExceptionM.mutateAsync({
                professional_id: selectedPro,
                start_date: newException.start_date,
                end_date: newException.end_date || undefined,
                reason: newException.reason || undefined,
                is_available: newException.is_available,
            });

            toast.success('Excepción añadida');
            setNewException({ start_date: '', end_date: '', reason: '', is_available: false });
        } catch (error: unknown) {
             toast.error(`Error al añadir excepción: ${getErrorMessage(error)}`);
        }
    }

    async function deleteException(id: string) {
        try {
            await deleteExceptionM.mutateAsync({ id, professional_id: selectedPro });
            toast.success('Excepción eliminada');
        } catch (error: unknown) {
            toast.error(`Error al eliminar excepción: ${getErrorMessage(error)}`);
        }
    }

    async function addPresetForDay(dayIndex: number) {
        if (!selectedPro) {
            toast.warning('Selecciona un profesional');
            return;
        }

        try {
            await createSlotM.mutateAsync({
                professional_id: selectedPro,
                day_of_week: toDbDayOfWeek(dayIndex),
                start_time: '09:30',
                end_time: '14:00',
            });
            await createSlotM.mutateAsync({
                professional_id: selectedPro,
                day_of_week: toDbDayOfWeek(dayIndex),
                start_time: '15:00',
                end_time: '20:00',
            });
            toast.success(`Horario base añadido para ${DAY_NAMES[dayIndex]}`);
        } catch (error: unknown) {
             toast.error(`Error al crear horario: ${getErrorMessage(error)}`);
        }
    }

    function applyDefaultSchedule() {
        setConfirmAction({
            title: 'Aplicar horario base',
            message: 'Aplicar horario base (L-V 9:30-14:00, 15:00-20:00)? Se eliminarán las franjas actuales.',
            onConfirm: async () => {
                setConfirmAction(null);

                try {
                    const defaultSlots = [];
                    for (let day = 0; day <= 4; day += 1) {
                        defaultSlots.push(
                            { day_of_week: toDbDayOfWeek(day), start_time: '09:30', end_time: '14:00' },
                            { day_of_week: toDbDayOfWeek(day), start_time: '15:00', end_time: '20:00' }
                        );
                    }

                    await applyDefaultM.mutateAsync({
                        professional_id: selectedPro,
                        slots: defaultSlots
                    });

                    toast.success('Horario base aplicado correctamente');
                } catch (error: unknown) {
                    toast.error(`Error al aplicar horario base: ${getErrorMessage(error)}`);
                }
            },
        });
    }

    if (isLoading && professionals.length === 0) {
        return (
            <div className="flex justify-center p-15">
                <div className="spinner" />
            </div>
        );
    }

    const slotsByDay = DAY_NAMES.map((name, index) => ({
        name,
        dayIndex: index,
        slots: slots.filter((slot) => toUiDayOfWeek(slot.day_of_week) === index),
    }));
    const weeklySlotCount = slots.length;
    const activeDays = slotsByDay.filter((day) => day.slots.length > 0).length;

    function coveragePct(daySlots: typeof slots): number {
        const WORK_MIN = 780; // 07:00–20:00
        const total = daySlots.reduce((acc, s) => {
            const [sh, sm] = s.start_time.split(':').map(Number);
            const [eh, em] = s.end_time.split(':').map(Number);
            return acc + (eh * 60 + em) - (sh * 60 + sm);
        }, 0);
        return Math.min(100, Math.round((total / WORK_MIN) * 100));
    }

    return (
        <div className="content-shell schedule-shell ops-screen">
            <header className="zs-hor-header">
                <div className="zs-hor-header__top">
                    <div className="zs-hor-header__lead">
                        <span className="zs-hor-header__eyebrow">Agenda</span>
                        <h1 className="zs-hor-header__title">Horarios</h1>
                        <p className="zs-hor-header__meta">{weeklySlotCount} franjas · {activeDays}/7 días activos · {exceptions.length} excepciones</p>
                    </div>
                    <div className="zs-hor-header__actions">
                        <label className="zs-hor-pro-picker">
                            <span className="zs-hor-pro-picker__label">Profesional</span>
                            <select
                                className="zs-hor-pro-picker__select"
                                value={selectedPro}
                                onChange={(e) => setSelectedPro(e.target.value)}
                            >
                                {professionals.map((p) => (
                                    <option key={p.id} value={p.id}>{p.profile?.full_name || 'Profesional'}</option>
                                ))}
                            </select>
                        </label>
                        <button
                            className="btn btn--secondary"
                            onClick={applyDefaultSchedule}
                            disabled={applyDefaultM.isPending}
                        >
                            {applyDefaultM.isPending ? <div className="spinner w-3.5 h-3.5"/> : <Icon name="refresh-cw" size={14} />}
                            Aplicar horario base
                        </button>
                    </div>
                </div>

                <div className="zs-hor-kpi-strip">
                    <div className="zs-hor-kpi zs-hor-kpi--neutral">
                        <p className="zs-hor-kpi__label">Franjas semanales</p>
                        <p className="zs-hor-kpi__value">{isLoadingHorario ? '…' : weeklySlotCount}</p>
                    </div>
                    <div className="zs-hor-kpi zs-hor-kpi--success">
                        <p className="zs-hor-kpi__label">Días activos</p>
                        <p className="zs-hor-kpi__value">{isLoadingHorario ? '…' : `${activeDays}/7`}</p>
                    </div>
                    <div className={`zs-hor-kpi ${exceptions.length > 0 ? 'zs-hor-kpi--warning' : 'zs-hor-kpi--neutral'}`}>
                        <p className="zs-hor-kpi__label">Excepciones</p>
                        <p className="zs-hor-kpi__value">{exceptions.length}</p>
                    </div>
                </div>
            </header>

            <div className="schedule-grid">
                <section className="card schedule-card">
                    <div className="card__header schedule-card__header">
                        <h2 className="card__title">Disponibilidad semanal</h2>
                        <p className="schedule-card__hint">Franjas base por día.</p>
                    </div>

                    <div className="card__body schedule-day-list">
                        {slotsByDay.map((day) => {
                            const pct = coveragePct(day.slots);
                            return (
                            <article
                                key={day.dayIndex}
                                className={`schedule-day ${day.slots.length > 0 ? '' : 'is-empty'}`}
                            >
                                {/* Coverage bar */}
                                <div className="zs-hor-coverage">
                                    <div className="zs-hor-coverage__fill" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="schedule-day__head">
                                    <h3 className="schedule-day__name">{day.name}</h3>
                                    <span className="schedule-day__count">
                                        {day.slots.length === 0 ? 'Sin franjas' : `${day.slots.length} franja${day.slots.length > 1 ? 's' : ''}`}
                                        {pct > 0 && <span className="zs-hor-coverage__pct">{pct}%</span>}
                                    </span>
                                </div>
                                <div className="schedule-day__slots">
                                    {day.slots.length === 0 ? (
                                        <div className="schedule-day__empty-box">
                                            <span className="schedule-day__empty">Día sin disponibilidad</span>
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
                                                    disabled={deleteSlotM.isPending}
                                                >
                                                    <Icon name="close" size={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </article>
                            );
                        })}
                    </div>

                    <div className="card__body schedule-slot-builder">
                        <h3 className="schedule-slot-builder__title">Añadir franja manual</h3>
                        <div className="schedule-slot-builder__form">
                            <div className="form-group">
                                <label className="form-label">Día</label>
                                <select
                                    className="form-input form-select"
                                    value={newSlot.day_of_week}
                                    onChange={(event) => setNewSlot({ ...newSlot, day_of_week: Number(event.target.value) })}
                                >
                                    {DAY_NAMES.map((name, index) => <option key={index} value={index}>{name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Desde</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={newSlot.start_time}
                                    onChange={(event) => setNewSlot({ ...newSlot, start_time: event.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hasta</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={newSlot.end_time}
                                    onChange={(event) => setNewSlot({ ...newSlot, end_time: event.target.value })}
                                />
                            </div>
                            <button
                                className="btn btn--primary schedule-slot-builder__submit"
                                onClick={addSlot}
                                disabled={createSlotM.isPending}
                            >
                                {createSlotM.isPending ? <div className="spinner w-3.5 h-3.5 [border-color:white] !border-b-transparent"/> : <Icon name="plus" size={14} />}
                                Añadir franja
                            </button>
                        </div>
                    </div>
                </section>

                <section className="card schedule-card schedule-card--exceptions">
                    <div className="card__header schedule-card__header">
                        <h2 className="card__title">Bloqueos y excepciones</h2>
                        <p className="schedule-card__hint">Días libres o aperturas extra.</p>
                    </div>
                    <div className="card__body schedule-exception-list">
                        {exceptions.length === 0 ? (
                            <div className="schedule-empty">
                                <Icon name="calendar" size={18} />
                                <p>Sin excepciones programadas</p>
                            </div>
                        ) : (
                            <div className="schedule-exception-items">
                                {exceptions.map((exception) => (
                                    <article key={exception.id} className={`schedule-exception-item ${exception.is_available ? 'is-available' : 'is-blocked'}`}>
                                        <div className="schedule-exception-item__content">
                                            <div className="schedule-exception-item__date">
                                                {new Date(`${exception.exception_date}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            {exception.reason && <div className="schedule-exception-item__reason">{exception.reason}</div>}
                                        </div>
                                        <div className="schedule-exception-item__actions">
                                            <span className={`badge ${exception.is_available ? 'badge--confirmed' : 'badge--warning'}`}>
                                                {exception.is_available ? 'Disponible' : 'No disponible'}
                                            </span>
                                            <button
                                                onClick={() => deleteException(exception.id)}
                                                className="schedule-exception-item__remove"
                                                aria-label="Eliminar excepción"
                                                disabled={deleteExceptionM.isPending}
                                            >
                                                <Icon name="close" size={12} />
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        <div className="schedule-exception-builder">
                            <h3 className="schedule-exception-builder__title">Nueva excepción</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Desde <span className="text-[var(--color-error,red)]">*</span></label>
                                    <input type="date" className="form-input" value={newException.start_date} onChange={(event) => setNewException({ ...newException, start_date: event.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hasta (opcional)</label>
                                    <input type="date" className="form-input" value={newException.end_date} onChange={(event) => setNewException({ ...newException, end_date: event.target.value })} min={newException.start_date} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Motivo</label>
                                <input className="form-input" placeholder="Ej: Vacaciones" value={newException.reason} onChange={(event) => setNewException({ ...newException, reason: event.target.value })} />
                            </div>

                            <div className="form-group schedule-exception-builder__checkbox">
                                <label className="form-checkbox-label">
                                    <input type="checkbox" checked={newException.is_available} onChange={(event) => setNewException({ ...newException, is_available: event.target.checked })} />
                                    <span>Disponibilidad extra (no día libre)</span>
                                </label>
                            </div>

                            <button
                                className="btn btn--primary schedule-exception-builder__submit"
                                onClick={addException}
                                disabled={createExceptionM.isPending}
                            >
                                {createExceptionM.isPending ? <div className="spinner w-3.5 h-3.5 [border-color:white] !border-b-transparent"/> : <Icon name="plus" size={14} />}
                                Añadir excepción
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
