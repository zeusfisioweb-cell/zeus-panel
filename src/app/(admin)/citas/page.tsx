'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { Appointment, Service, Professional } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

export default function CitasPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

    // New appointment modal
    const [showNewModal, setShowNewModal] = useState(false);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [newForm, setNewForm] = useState({
        patient_name: '',
        patient_phone: '',
        patient_email: '',
        service_id: '',
        professional_id: '',
        time: '09:00',
        notes: '',
    });
    const [saving, setSaving] = useState(false);

    // Cancel appointment modal
    const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const loadFormData = useCallback(async () => {
        const [servicesRes, profRes] = await Promise.all([
            supabase.from('services').select('*').eq('is_active', true).order('name'),
            supabase.from('professionals').select('*, profile:profiles(*)').eq('is_active', true),
        ]);
        setServices(servicesRes.data as Service[] || []);
        setProfessionals(profRes.data as Professional[] || []);
    }, []);

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('appointments')
            .select('*, service:services(name, category_id), professional:professionals(*, profile:profiles(full_name))')
            .gte('start_time', `${dateFilter}T00:00:00`)
            .lte('start_time', `${dateFilter}T23:59:59`)
            .order('start_time', { ascending: true });

        if (filter !== 'all') {
            query = query.eq('status', filter);
        }

        const { data } = await query;
        setAppointments(data as Appointment[] || []);
        setLoading(false);
    }, [dateFilter, filter]);

    useEffect(() => {
        loadAppointments();
        loadFormData();
    }, [loadAppointments, loadFormData]);

    async function updateStatus(id: string, status: string) {
        await supabase.from('appointments').update({ status }).eq('id', id);
        loadAppointments();
    }

    async function confirmCancel() {
        if (!cancelTarget) return;
        await supabase
            .from('appointments')
            .update({ status: 'cancelled', cancellation_reason: cancelReason || null })
            .eq('id', cancelTarget.id);
        setCancelTarget(null);
        setCancelReason('');
        loadAppointments();
    }

    async function deleteAppointment(id: string) {
        await supabase.from('appointments').delete().eq('id', id);
        loadAppointments();
    }

    async function handleNewAppointment(e: React.FormEvent) {
        e.preventDefault();
        if (!newForm.patient_name || !newForm.service_id) return;
        setSaving(true);

        const service = services.find(s => s.id === newForm.service_id);
        const startTime = new Date(`${dateFilter}T${newForm.time}:00`);
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
        setNewForm({ patient_name: '', patient_phone: '', patient_email: '', service_id: services[0]?.id || '', professional_id: '', time: '09:00', notes: '' });
        loadAppointments();
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const navigateDate = (days: number) => {
        const d = new Date(dateFilter);
        d.setDate(d.getDate() + days);
        setDateFilter(d.toISOString().split('T')[0]);
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Citas</h1>
                    <p className="page-subtitle">Gestión de citas y reservas</p>
                </div>
                <button className="btn btn--primary" onClick={() => {
                    setNewForm(f => ({ ...f, service_id: services[0]?.id || '', time: '09:00' }));
                    setShowNewModal(true);
                }}>
                    + Nueva cita
                </button>
            </div>

            {/* Filters bar */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card__body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '14px 20px' }}>
                    <button className="btn btn--secondary btn--sm" onClick={() => navigateDate(-1)}>◀</button>
                    <input
                        type="date"
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                    />
                    <button className="btn btn--secondary btn--sm" onClick={() => navigateDate(1)}>▶</button>
                    <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                    >
                        Hoy
                    </button>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map(f => (
                            <button
                                key={f}
                                className={`btn btn--sm ${filter === f ? 'btn--primary' : 'btn--ghost'}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'Todas' : STATUS_LABELS[f as keyof typeof STATUS_LABELS]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card__body" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                            <div className="spinner" />
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon"><Icon name="calendar" size={40} /></div>
                            <div className="empty-state__title">Sin citas</div>
                            <div className="empty-state__text">No hay citas para esta fecha</div>
                            <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setShowNewModal(true)}>
                                + Nueva cita
                            </button>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Hora</th>
                                        <th>Paciente</th>
                                        <th>Servicio</th>
                                        <th>Profesional</th>
                                        <th>Estado</th>
                                        <th>Origen</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((apt) => (
                                        <tr key={apt.id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {apt.patient_name || '—'}
                                                    {apt.source !== 'web' && (
                                                        <span title="Firma RGPD pendiente o en papel" style={{ color: 'var(--danger)', fontSize: 12, cursor: 'help' }}>
                                                            ⚠️ RGPD
                                                        </span>
                                                    )}
                                                </div>
                                                {apt.patient_phone && (
                                                    <div style={{ fontSize: 11, color: 'var(--gris)', marginTop: 2 }}>{apt.patient_phone}</div>
                                                )}
                                            </td>
                                            <td>{apt.service?.name || '—'}</td>
                                            <td>{apt.professional?.profile?.full_name || '—'}</td>
                                            <td>
                                                <span className={`badge badge--${apt.status}`}>
                                                    {STATUS_LABELS[apt.status]}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--gris)' }}>
                                                {apt.source === 'web' ? <><Icon name="globe" size={14} /> Web</> : apt.source === 'phone' ? <><Icon name="phone" size={14} /> Tel</> : <><Icon name="user" size={14} /> Admin</>}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {apt.status === 'pending' && (
                                                        <button
                                                            className="btn btn--primary btn--sm"
                                                            onClick={() => updateStatus(apt.id, 'confirmed')}
                                                            title="Confirmar"
                                                        >
                                                            <Icon name="check" size={14} />
                                                        </button>
                                                    )}
                                                    {apt.status === 'confirmed' && (
                                                        <button
                                                            className="btn btn--sm"
                                                            style={{ background: 'var(--info)', color: '#fff' }}
                                                            onClick={() => updateStatus(apt.id, 'completed')}
                                                            title="Marcar completada"
                                                        >
                                                            <Icon name="check" size={14} /><Icon name="check" size={14} />
                                                        </button>
                                                    )}
                                                    {apt.status !== 'cancelled' && (
                                                        <button
                                                            className="btn btn--ghost btn--sm"
                                                            onClick={() => { setCancelTarget(apt); setCancelReason(''); }}
                                                            title="Cancelar cita"
                                                        >
                                                            <Icon name="close" size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn--ghost btn--sm"
                                                        style={{ color: 'var(--danger)' }}
                                                        onClick={() => deleteAppointment(apt.id)}
                                                        title="Eliminar permanentemente"
                                                    >
                                                        <Icon name="trash" size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal nueva cita */}
            {showNewModal && (
                <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="modal modal--lg" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">Nueva cita — {new Date(dateFilter).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                            <button className="modal__close" onClick={() => setShowNewModal(false)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
                        </div>
                        <form onSubmit={handleNewAppointment}>
                            <div className="modal__body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="nc_patient_name">Nombre del paciente *</label>
                                        <input id="nc_patient_name" className="form-input" value={newForm.patient_name} onChange={e => setNewForm({ ...newForm, patient_name: e.target.value })} required placeholder="Nombre completo…" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="nc_phone">Teléfono</label>
                                        <input id="nc_phone" type="tel" className="form-input" value={newForm.patient_phone} onChange={e => setNewForm({ ...newForm, patient_phone: e.target.value })} placeholder="600 000 000…" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="nc_email">Email</label>
                                        <input id="nc_email" type="email" className="form-input" value={newForm.patient_email} onChange={e => setNewForm({ ...newForm, patient_email: e.target.value })} placeholder="paciente@email.com…" spellCheck={false} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="nc_service">Servicio *</label>
                                        <select id="nc_service" className="form-input form-select" value={newForm.service_id} onChange={e => setNewForm({ ...newForm, service_id: e.target.value })} required>
                                            <option value="">Seleccionar servicio…</option>
                                            {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} min</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" htmlFor="nc_professional">Profesional</label>
                                        <select id="nc_professional" className="form-input form-select" value={newForm.professional_id} onChange={e => setNewForm({ ...newForm, professional_id: e.target.value })}>
                                            <option value="">Sin asignar</option>
                                            {professionals.map(p => <option key={p.id} value={p.id}>{p.profile?.full_name}{p.specialty ? ` — ${p.specialty}` : ''}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="nc_time">Hora *</label>
                                        <input id="nc_time" type="time" className="form-input" value={newForm.time} onChange={e => setNewForm({ ...newForm, time: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="nc_notes">Notas</label>
                                        <input id="nc_notes" className="form-input" value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} placeholder="Observaciones…" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn--secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn--primary" disabled={saving}>
                                    {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Guardando...</> : <><Icon name="check" size={14} /> Confirmar cita</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal cancelar cita */}
            {cancelTarget && (
                <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">Cancelar cita</h3>
                            <button className="modal__close" onClick={() => setCancelTarget(null)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
                        </div>
                        <div className="modal__body">
                            <p style={{ marginBottom: 16, color: 'var(--gris)' }}>
                                ¿Cancelar la cita de <strong>{cancelTarget.patient_name}</strong> a las {formatTime(cancelTarget.start_time)}?
                            </p>
                            <div className="form-group">
                                <label className="form-label" htmlFor="cancel_reason">Motivo de cancelación (opcional)</label>
                                <input
                                    id="cancel_reason"
                                    className="form-input"
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                    placeholder="Ej: paciente no se presentó…"
                                />
                            </div>
                        </div>
                        <div className="modal__footer">
                            <button className="btn btn--secondary" onClick={() => setCancelTarget(null)}>Volver</button>
                            <button className="btn btn--danger" onClick={confirmCancel}>Cancelar cita</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
