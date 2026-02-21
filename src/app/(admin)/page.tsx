'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { Appointment, Service, Professional } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types';

export default function DashboardPage() {
    const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
    const [weekChart, setWeekChart] = useState<{ day: string; count: number }[]>([]);
    const [stats, setStats] = useState({
        todayCount: 0,
        weekCount: 0,
        totalPatients: 0,
        pendingCount: 0,
    });
    const [loading, setLoading] = useState(true);

    // Modal nueva cita
    const [showNewModal, setShowNewModal] = useState(false);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [newForm, setNewForm] = useState({
        patient_name: '',
        patient_phone: '',
        patient_email: '',
        service_id: '',
        professional_id: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        notes: '',
        source: 'admin' as const,
    });
    const [saving, setSaving] = useState(false);

    async function loadDashboard() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Build 7-day chart data
        const days: { day: string; date: string }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push({
                day: d.toLocaleDateString('es-ES', { weekday: 'short' }),
                date: d.toISOString().split('T')[0],
            });
        }

        const [appointmentsRes, weekRes, patientsRes, pendingRes, servicesRes, profRes] =
            await Promise.all([
                supabase
                    .from('appointments')
                    .select('*, service:services(*), professional:professionals(*, profile:profiles(*))')
                    .gte('start_time', `${todayStr}T00:00:00`)
                    .lte('start_time', `${todayStr}T23:59:59`)
                    .order('start_time', { ascending: true }),
                supabase
                    .from('appointments')
                    .select('id', { count: 'exact' })
                    .gte('start_time', weekStart.toISOString())
                    .lte('start_time', weekEnd.toISOString())
                    .neq('status', 'cancelled'),
                supabase.from('patients').select('id', { count: 'exact' }),
                supabase
                    .from('appointments')
                    .select('id', { count: 'exact' })
                    .eq('status', 'pending'),
                supabase.from('services').select('*').eq('is_active', true).order('name'),
                supabase
                    .from('professionals')
                    .select('*, profile:profiles(*)')
                    .eq('is_active', true),
            ]);

        // Build chart counts per day
        const chartData = await Promise.all(
            days.map(async ({ day, date }) => {
                const { count } = await supabase
                    .from('appointments')
                    .select('id', { count: 'exact' })
                    .gte('start_time', `${date}T00:00:00`)
                    .lte('start_time', `${date}T23:59:59`)
                    .neq('status', 'cancelled');
                return { day, count: count || 0 };
            })
        );

        setTodayAppointments(appointmentsRes.data as Appointment[] || []);
        setWeekChart(chartData);
        setStats({
            todayCount: (appointmentsRes.data || []).filter(a => a.status !== 'cancelled').length,
            weekCount: weekRes.count || 0,
            totalPatients: patientsRes.count || 0,
            pendingCount: pendingRes.count || 0,
        });
        setServices(servicesRes.data as Service[] || []);
        setProfessionals(profRes.data as Professional[] || []);
        setLoading(false);
    }

    useEffect(() => {
        loadDashboard();
    }, []);

    async function updateAppointmentStatus(id: string, status: string) {
        await supabase.from('appointments').update({ status }).eq('id', id);
        loadDashboard();
    }

    async function handleNewAppointment(e: React.FormEvent) {
        e.preventDefault();
        if (!newForm.patient_name || !newForm.service_id || !newForm.date || !newForm.time) return;
        setSaving(true);

        const service = services.find(s => s.id === newForm.service_id);
        const startTime = new Date(`${newForm.date}T${newForm.time}:00`);
        const endTime = new Date(startTime.getTime() + (service?.duration_minutes || 60) * 60000);

        await supabase.from('appointments').insert({
            patient_name: newForm.patient_name,
            patient_phone: newForm.patient_phone || null,
            patient_email: newForm.patient_email || null,
            service_id: newForm.service_id,
            professional_id: newForm.professional_id || null,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            notes: newForm.notes || null,
            source: 'admin',
            status: 'confirmed',
        });

        setSaving(false);
        setShowNewModal(false);
        setNewForm({
            patient_name: '',
            patient_phone: '',
            patient_email: '',
            service_id: services[0]?.id || '',
            professional_id: '',
            date: new Date().toISOString().split('T')[0],
            time: '09:00',
            notes: '',
            source: 'admin',
        });
        loadDashboard();
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const maxChartCount = Math.max(...weekChart.map(d => d.count), 1);

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">
                        {new Date().toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                </div>
                <button className="btn btn--primary" onClick={() => {
                    setNewForm(f => ({ ...f, service_id: services[0]?.id || '' }));
                    setShowNewModal(true);
                }}>
                    <Icon name="plus" size={16} /> Nueva cita
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card__icon stat-card__icon--canela"><Icon name="calendar" /></div>
                    <div>
                        <div className="stat-card__value">{stats.todayCount}</div>
                        <div className="stat-card__label">Citas hoy</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon stat-card__icon--info"><Icon name="chart" /></div>
                    <div>
                        <div className="stat-card__value">{stats.weekCount}</div>
                        <div className="stat-card__label">Esta semana</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon stat-card__icon--success"><Icon name="users" /></div>
                    <div>
                        <div className="stat-card__value">{stats.totalPatients}</div>
                        <div className="stat-card__label">Pacientes totales</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon stat-card__icon--warning"><Icon name="hourglass" /></div>
                    <div>
                        <div className="stat-card__value">{stats.pendingCount}</div>
                        <div className="stat-card__label">Citas Pendientes</div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--canela)' }}>
                    <div className="stat-card__icon" style={{ background: 'var(--bg-base)', color: 'var(--canela-dark)' }}>
                        <Icon name="shield" />
                    </div>
                    <div>
                        <div className="stat-card__value">3</div>
                        <div className="stat-card__label">Alertas LOPD/RGPD</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Mini chart */}
                <div className="card">
                    <div className="card__header">
                        <h2 className="card__title">Últimos 7 días</h2>
                    </div>
                    <div className="card__body">
                        <div className="mini-chart">
                            {weekChart.map((d, i) => (
                                <div key={i} className="mini-chart__col">
                                    <div
                                        className="mini-chart__bar"
                                        style={{
                                            height: `${Math.max((d.count / maxChartCount) * 100, d.count > 0 ? 8 : 0)}%`,
                                        }}
                                        title={`${d.count} citas`}
                                    />
                                    <div className="mini-chart__label">{d.day}</div>
                                    <div className="mini-chart__count">{d.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick actions */}
                <div className="card">
                    <div className="card__header">
                        <h2 className="card__title">Acciones rápidas</h2>
                    </div>
                    <div className="card__body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button
                                className="btn btn--ghost"
                                onClick={() => {
                                    setNewForm(f => ({ ...f, service_id: services[0]?.id || '' }));
                                    setShowNewModal(true);
                                }}
                                style={{ justifyContent: 'flex-start', paddingLeft: 8 }}
                            >
                                <Icon name="plus" size={16} /> Nueva cita
                            </button>
                            <a href="/citas" className="btn btn--ghost" style={{ justifyContent: 'flex-start', paddingLeft: 8 }}>
                                <Icon name="calendar" size={16} /> Ver agenda del día
                            </a>
                            <a href="/pacientes" className="btn btn--ghost" style={{ justifyContent: 'flex-start', paddingLeft: 8 }}>
                                <Icon name="users" size={16} /> Gestionar pacientes
                            </a>
                            {stats.pendingCount > 0 && (
                                <div style={{ marginTop: 24, padding: '12px 16px', background: 'var(--warning-bg)', border: '1px solid #FCD34D', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Icon name="warning" size={16} style={{ color: 'var(--warning)' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{stats.pendingCount} citas pendientes</div>
                                        <div style={{ fontSize: 12, color: 'var(--warning)' }}>Requieren confirmación</div>
                                    </div>
                                    <a href="/citas" className="btn btn--sm btn--primary">
                                        Revisar
                                    </a>
                                </div>
                            )}

                            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid #FCA5A5', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Icon name="shield" size={16} style={{ color: 'var(--danger)', marginTop: 2 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>3 Consentimientos Pendientes</div>
                                    <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>Nuevos pacientes sin firmar la RGPD.</div>
                                </div>
                                <a href="/legal" className="btn btn--sm btn--danger">
                                    Gestionar
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's appointments */}
            <div className="card">
                <div className="card__header">
                    <h2 className="card__title">Citas de hoy</h2>
                    <span className="badge badge--pending" style={{ fontSize: 12 }}>
                        {todayAppointments.filter(a => a.status !== 'cancelled').length} activas
                    </span>
                </div>
                <div className="card__body" style={{ padding: 0 }}>
                    {todayAppointments.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon"><Icon name="calendar" size={40} /></div>
                            <div className="empty-state__title">Sin citas para hoy</div>
                            <div className="empty-state__text">No hay citas programadas</div>
                            <button
                                className="btn btn--primary"
                                style={{ marginTop: 16 }}
                                onClick={() => {
                                    setNewForm(f => ({ ...f, service_id: services[0]?.id || '' }));
                                    setShowNewModal(true);
                                }}
                            >
                                <Icon name="plus" size={16} /> Nueva cita
                            </button>
                        </div>
                    ) : (
                        <div className="timeline" style={{ padding: 16 }}>
                            {todayAppointments.map((apt) => (
                                <div key={apt.id} className="timeline-item">
                                    <div className="timeline-item__time">
                                        {formatTime(apt.start_time)}
                                    </div>
                                    <div
                                        className="timeline-item__dot"
                                        style={{ backgroundColor: STATUS_COLORS[apt.status] }}
                                    />
                                    <div
                                        className="timeline-item__content"
                                        style={{ transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
                                        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                                    >
                                        <div className="timeline-item__title">
                                            {apt.patient_name || 'Paciente'}
                                            {' — '}
                                            {apt.service?.name || 'Servicio'}
                                        </div>
                                        <div className="timeline-item__subtitle">
                                            {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                                            {apt.professional?.profile?.full_name && (
                                                <> · {apt.professional.profile.full_name}</>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span className={`badge badge--${apt.status}`}>
                                            {STATUS_LABELS[apt.status]}
                                        </span>
                                        {apt.status === 'pending' && (
                                            <button
                                                className="btn btn--primary btn--sm"
                                                onClick={() => updateAppointmentStatus(apt.id, 'confirmed')}
                                            >
                                                Confirmar
                                            </button>
                                        )}
                                        {apt.status === 'confirmed' && (
                                            <button
                                                className="btn btn--sm btn--primary"
                                                onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                                            >
                                                <Icon name="check" size={14} /> Finalizar
                                            </button>
                                        )}
                                        {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                            <button
                                                className="btn btn--ghost btn--sm"
                                                onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                                            >
                                                <Icon name="close" size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal nueva cita */}
            {showNewModal && (
                <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="modal modal--lg" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">Nueva cita</h3>
                            <button className="modal__close" onClick={() => setShowNewModal(false)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
                        </div>
                        <form onSubmit={handleNewAppointment}>
                            <div className="modal__body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="patient_name">Nombre del paciente *</label>
                                        <input
                                            id="patient_name"
                                            className="form-input"
                                            value={newForm.patient_name}
                                            onChange={e => setNewForm({ ...newForm, patient_name: e.target.value })}
                                            required
                                            autoComplete="off"
                                            placeholder="Nombre completo…"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="patient_phone">Teléfono</label>
                                        <input
                                            id="patient_phone"
                                            type="tel"
                                            className="form-input"
                                            value={newForm.patient_phone}
                                            onChange={e => setNewForm({ ...newForm, patient_phone: e.target.value })}
                                            autoComplete="tel"
                                            placeholder="600 000 000…"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="patient_email">Email</label>
                                        <input
                                            id="patient_email"
                                            type="email"
                                            className="form-input"
                                            value={newForm.patient_email}
                                            onChange={e => setNewForm({ ...newForm, patient_email: e.target.value })}
                                            autoComplete="email"
                                            placeholder="paciente@email.com…"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="service_id">Servicio *</label>
                                        <select
                                            id="service_id"
                                            className="form-input form-select"
                                            value={newForm.service_id}
                                            onChange={e => setNewForm({ ...newForm, service_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccionar servicio…</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} — {s.duration_minutes} min — {Number(s.price).toFixed(0)}€
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="professional_id">Profesional</label>
                                        <select
                                            id="professional_id"
                                            className="form-input form-select"
                                            value={newForm.professional_id}
                                            onChange={e => setNewForm({ ...newForm, professional_id: e.target.value })}
                                        >
                                            <option value="">Sin asignar</option>
                                            {professionals.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.profile?.full_name || 'Profesional'}{p.specialty ? ` — ${p.specialty}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="apt_date">Fecha *</label>
                                        <input
                                            id="apt_date"
                                            type="date"
                                            className="form-input"
                                            value={newForm.date}
                                            onChange={e => setNewForm({ ...newForm, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="apt_time">Hora *</label>
                                        <input
                                            id="apt_time"
                                            type="time"
                                            className="form-input"
                                            value={newForm.time}
                                            onChange={e => setNewForm({ ...newForm, time: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="apt_notes">Notas internas</label>
                                        <textarea
                                            id="apt_notes"
                                            className="form-input"
                                            value={newForm.notes}
                                            onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                                            rows={2}
                                            placeholder="Observaciones, motivo de consulta…"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn--secondary" onClick={() => setShowNewModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn--primary" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                                            Guardando…
                                        </>
                                    ) : (
                                        <><Icon name="check" size={14} /> Confirmar cita</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
