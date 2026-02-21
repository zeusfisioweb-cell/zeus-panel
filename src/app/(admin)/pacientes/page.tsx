'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { Patient, Appointment } from '@/lib/types';

export default function PacientesPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);

    const [showNewModal, setShowNewModal] = useState(false);
    const [form, setForm] = useState({
        first_name: '', last_name: '', document_id: '',
        phone: '', email: '', birth_date: '',
        gdpr_consent: false,
    });

    useEffect(() => {
        loadPatients();
    }, []);

    async function loadPatients() {
        const { data } = await supabase
            .from('patients')
            .select('*')
            .order('created_at', { ascending: false });
        setPatients(data as Patient[] || []);
        setLoading(false);
    }

    async function viewPatient(p: Patient) {
        setSelectedPatient(p);
        const { data } = await supabase
            .from('appointments')
            .select('*, service:services(name)')
            .eq('patient_id', p.id)
            .order('start_time', { ascending: false })
            .limit(20);
        setPatientAppointments(data as Appointment[] || []);
    }

    async function deletePatient(id: string) {
        if (!confirm('¿Eliminar paciente y todos sus datos? Esta acción no se puede deshacer.')) return;
        await supabase.from('consent_records').delete().eq('patient_id', id);
        await supabase.from('appointments').update({ patient_id: null }).eq('patient_id', id);
        await supabase.from('patients').delete().eq('id', id);
        setSelectedPatient(null);
        loadPatients();
    }

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        const payload = {
            first_name: form.first_name,
            last_name: form.last_name,
            document_id: form.document_id || null,
            phone: form.phone || null,
            email: form.email || null,
            birth_date: form.birth_date || null,
            gdpr_consent: form.gdpr_consent,
            marketing_consent: false,
        };

        const { error } = await supabase.from('patients').insert(payload);
        if (!error) {
            setShowNewModal(false);
            setForm({ first_name: '', last_name: '', document_id: '', phone: '', email: '', birth_date: '', gdpr_consent: false });
            loadPatients();
        } else {
            console.error(error);
            alert('Error al crear paciente: ' + error.message);
        }
    }

    const filtered = patients.filter(p => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) ||
            (p.phone && p.phone.includes(s)) ||
            (p.email && p.email.toLowerCase().includes(s))
        );
    });

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pacientes</h1>
                    <p className="page-subtitle">{patients.length} pacientes registrados en el sistema</p>
                </div>
                <button className="btn btn--primary" onClick={() => setShowNewModal(true)}>
                    <Icon name="plus" size={16} /> Nuevo Paciente
                </button>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card__body" style={{ padding: '16px 24px', display: 'flex', gap: 16 }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                        <div style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }}>
                            <Icon name="search" size={16} />
                        </div>
                        <input
                            className="form-input"
                            placeholder="Buscar por nombre, teléfono o email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 36 }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedPatient ? '1fr 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
                <div className="card">
                    <div className="card__body" style={{ padding: 0 }}>
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Contacto</th>
                                        <th>RGPD</th>
                                        <th>Alta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(p => (
                                        <tr
                                            key={p.id}
                                            onClick={() => viewPatient(p)}
                                            style={{ cursor: 'pointer', background: selectedPatient?.id === p.id ? 'var(--bg-hover)' : undefined }}
                                        >
                                            <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{p.first_name} {p.last_name}</td>
                                            <td>
                                                <div style={{ fontSize: 13, color: 'var(--text-main)' }}>{p.phone || '—'}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.email || '—'}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${p.gdpr_consent ? 'badge--confirmed' : 'badge-default'}`}>
                                                    {p.gdpr_consent ? 'Sí' : 'No'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                                {new Date(p.created_at).toLocaleDateString('es-ES')}
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="empty-state">
                                                <div className="empty-state__icon"><Icon name="users" size={24} /></div>
                                                <div className="empty-state__title">Sin resultados</div>
                                                <div className="empty-state__text">No se encontraron pacientes que coincidan con la búsqueda.</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {selectedPatient && (
                    <div className="card" style={{ position: 'sticky', top: 24 }}>
                        <div className="card__header">
                            <h2 className="card__title">
                                {selectedPatient.first_name} {selectedPatient.last_name}
                            </h2>
                            <button className="modal__close" onClick={() => setSelectedPatient(null)}><Icon name="close" size={18} /></button>
                        </div>
                        <div className="card__body">
                            <div className="form-grid-2" style={{ marginBottom: 24 }}>
                                <div>
                                    <div className="form-label text-muted">Teléfono</div>
                                    <div className="text-main" style={{ fontSize: 14 }}>{selectedPatient.phone || '—'}</div>
                                </div>
                                <div>
                                    <div className="form-label text-muted">Email</div>
                                    <div className="text-main" style={{ fontSize: 14, wordBreak: 'break-all' }}>{selectedPatient.email || '—'}</div>
                                </div>
                                <div>
                                    <div className="form-label text-muted">Documento (DNI/NIE)</div>
                                    <div className="text-main" style={{ fontSize: 14 }}>{selectedPatient.document_id || '—'}</div>
                                </div>
                                <div>
                                    <div className="form-label text-muted">Fecha nacimiento</div>
                                    <div className="text-main" style={{ fontSize: 14 }}>{selectedPatient.birth_date ? new Date(selectedPatient.birth_date).toLocaleDateString('es-ES') : '—'}</div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16 }}>
                                Historial clínico reciente
                            </h3>
                            {patientAppointments.length === 0 ? (
                                <p className="text-sm text-muted">Aún no hay citas registradas para este paciente.</p>
                            ) : (
                                <div className="timeline">
                                    {patientAppointments.map(a => (
                                        <div key={a.id} className="timeline-item">
                                            <div className="timeline-item__content">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div className="timeline-item__title">{a.service?.name || 'Servicio General'}</div>
                                                        <div className="timeline-item__time">
                                                            {new Date(a.start_time).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <span className={`badge badge--${a.status}`}>{a.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                                <button
                                    className="btn btn--danger btn--sm"
                                    onClick={() => deletePatient(selectedPatient.id)}
                                >
                                    <Icon name="trash" size={14} /> Eliminar permanentemente
                                </button>
                                <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 8 }}>
                                    Cumplimiento RGPD: Esta acción borra todos los rastros identificables del paciente.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showNewModal && (
                <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">Añadir Nuevo Paciente</h3>
                            <button className="modal__close" onClick={() => setShowNewModal(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal__body">
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Nombre</label>
                                        <input required className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Ej: Ana" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Apellidos</label>
                                        <input required className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Ej: García López" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Teléfono</label>
                                        <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+34 600 000 000" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ana@ejemplo.com" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">DNI / NIE</label>
                                        <input className="form-input" value={form.document_id} onChange={e => setForm({ ...form, document_id: e.target.value })} placeholder="12345678A" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de nacimiento</label>
                                        <input type="date" className="form-input" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: 8 }}>
                                    <label className="form-checkbox-label">
                                        <input type="checkbox" checked={form.gdpr_consent} onChange={e => setForm({ ...form, gdpr_consent: e.target.checked })} />
                                        <span>El paciente ha aceptado la política de privacidad (RGPD)</span>
                                    </label>
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn--secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn--primary">Guardar paciente</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
