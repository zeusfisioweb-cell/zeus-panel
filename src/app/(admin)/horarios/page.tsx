'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { ScheduleSlot, ScheduleException } from '@/lib/types';
import { DAY_NAMES } from '@/lib/types';

interface ProfessionalOption {
    id: string;
    profile: { full_name: string } | null;
}

export default function HorariosPage() {
    const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
    const [selectedPro, setSelectedPro] = useState<string>('');
    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
    const [loading, setLoading] = useState(true);

    // New slot form
    const [newSlot, setNewSlot] = useState({ day_of_week: 0, start_time: '09:30', end_time: '14:00' });
    // New exception form
    const [newException, setNewException] = useState({ exception_date: '', reason: '', is_available: false });

    const loadProfessionals = useCallback(async () => {
        const { data } = await supabase
            .from('professionals')
            .select('id, profile:profiles(full_name)')
            .eq('is_active', true);
        setProfessionals((data as unknown as ProfessionalOption[]) || []);
        if (data && data.length > 0) setSelectedPro(data[0].id);
        setLoading(false);
    }, []);

    const loadSchedule = useCallback(async () => {
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
        setSlots(slotsRes.data as ScheduleSlot[] || []);
        setExceptions(excRes.data as ScheduleException[] || []);
    }, [selectedPro]);

    useEffect(() => {
        loadProfessionals();
    }, [loadProfessionals]);

    useEffect(() => {
        if (selectedPro) loadSchedule();
    }, [selectedPro, loadSchedule]);

    async function addSlot() {
        await supabase.from('schedule_slots').insert({
            professional_id: selectedPro,
            ...newSlot,
        });
        loadSchedule();
    }

    async function deleteSlot(id: string) {
        await supabase.from('schedule_slots').delete().eq('id', id);
        loadSchedule();
    }

    async function addException() {
        if (!newException.exception_date) return;
        await supabase.from('schedule_exceptions').insert({
            professional_id: selectedPro,
            ...newException,
        });
        setNewException({ exception_date: '', reason: '', is_available: false });
        loadSchedule();
    }

    async function deleteException(id: string) {
        await supabase.from('schedule_exceptions').delete().eq('id', id);
        loadSchedule();
    }

    async function applyDefaultSchedule() {
        if (!confirm('¿Aplicar horario por defecto (L-V 9:30-14:00, 15:00-20:00)?')) return;
        // Delete existing slots
        await supabase.from('schedule_slots').delete().eq('professional_id', selectedPro);
        // Insert default L-V
        const defaultSlots = [];
        for (let day = 0; day <= 4; day++) {
            defaultSlots.push(
                { professional_id: selectedPro, day_of_week: day, start_time: '09:30', end_time: '14:00' },
                { professional_id: selectedPro, day_of_week: day, start_time: '15:00', end_time: '20:00' },
            );
        }
        await supabase.from('schedule_slots').insert(defaultSlots);
        loadSchedule();
    }

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

    // Group slots by day
    const slotsByDay = DAY_NAMES.map((name, i) => ({
        name,
        dayIndex: i,
        slots: slots.filter(s => s.day_of_week === i),
    }));

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Horarios</h1>
                    <p className="page-subtitle">Disponibilidad semanal y excepciones</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select
                        className="form-input form-select"
                        style={{ width: 'auto' }}
                        value={selectedPro}
                        onChange={e => setSelectedPro(e.target.value)}
                    >
                        {professionals.map(p => (
                            <option key={p.id} value={p.id}>{p.profile?.full_name || 'Profesional'}</option>
                        ))}
                    </select>
                    <button className="btn btn--secondary" onClick={applyDefaultSchedule}>
                        Horario por defecto
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                {/* Weekly schedule */}
                <div className="card">
                    <div className="card__header">
                        <h2 className="card__title">Horario semanal</h2>
                    </div>
                    <div className="card__body" style={{ padding: 0 }}>
                        {slotsByDay.map(day => (
                            <div key={day.dayIndex} style={{
                                display: 'flex', alignItems: 'center', padding: '12px 20px',
                                borderBottom: '1px solid var(--crema-dark)',
                                background: day.slots.length > 0 ? 'transparent' : 'var(--crema)',
                            }}>
                                <div style={{ width: 100, fontWeight: 600, fontSize: 13 }}>{day.name}</div>
                                <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {day.slots.length === 0 ? (
                                        <span style={{ color: 'var(--gris-light)', fontSize: 12 }}>Libre</span>
                                    ) : (
                                        day.slots.map(slot => (
                                            <div key={slot.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                background: 'rgba(173,115,50,0.1)', padding: '4px 10px',
                                                borderRadius: 'var(--radius-sm)', fontSize: 13,
                                            }}>
                                                <span>{slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}</span>
                                                <button
                                                    onClick={() => deleteSlot(slot.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, padding: 0 }}
                                                ><Icon name="close" size={12} /></button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add slot form */}
                    <div className="card__body" style={{
                        borderTop: '1px solid var(--crema-dark)',
                        display: 'flex', gap: 10, alignItems: 'flex-end',
                    }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Día</label>
                            <select className="form-input form-select" value={newSlot.day_of_week} onChange={e => setNewSlot({ ...newSlot, day_of_week: +e.target.value })} style={{ width: 'auto' }}>
                                {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Desde</label>
                            <input type="time" className="form-input" value={newSlot.start_time} onChange={e => setNewSlot({ ...newSlot, start_time: e.target.value })} style={{ width: 'auto' }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Hasta</label>
                            <input type="time" className="form-input" value={newSlot.end_time} onChange={e => setNewSlot({ ...newSlot, end_time: e.target.value })} style={{ width: 'auto' }} />
                        </div>
                        <button className="btn btn--primary" onClick={addSlot}>+ Añadir</button>
                    </div>
                </div>

                {/* Exceptions */}
                <div className="card">
                    <div className="card__header">
                        <h2 className="card__title">Excepciones</h2>
                    </div>
                    <div className="card__body">
                        {exceptions.length === 0 ? (
                            <p style={{ color: 'var(--gris)', fontSize: 13 }}>Sin excepciones programadas</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                {exceptions.map(ex => (
                                    <div key={ex.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                        background: ex.is_available ? 'var(--success-bg)' : 'var(--danger-bg)',
                                        fontSize: 13,
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>
                                                {new Date(ex.exception_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            {ex.reason && <div style={{ fontSize: 11, color: 'var(--gris)' }}>{ex.reason}</div>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className={`badge ${ex.is_available ? 'badge--confirmed' : 'badge--cancelled'}`}>
                                                {ex.is_available ? 'Extra' : 'Libre'}
                                            </span>
                                            <button onClick={() => deleteException(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}><Icon name="close" size={12} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid var(--crema-dark)', paddingTop: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input type="date" className="form-input" value={newException.exception_date} onChange={e => setNewException({ ...newException, exception_date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Motivo</label>
                                <input className="form-input" placeholder="Ej: Vacaciones" value={newException.reason} onChange={e => setNewException({ ...newException, reason: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={newException.is_available} onChange={e => setNewException({ ...newException, is_available: e.target.checked })} />
                                    <span style={{ fontSize: 12 }}>Disponibilidad extra (no día libre)</span>
                                </label>
                            </div>
                            <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addException}>
                                + Añadir excepción
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
