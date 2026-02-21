'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { Service, ServiceCategory } from '@/lib/types';

interface ProfessionalRow {
    id: string; // Typically linked to auth.users / profiles
    specialty: string | null;
    license_number: string | null;
    bio: string | null;
    color_code: string;
    is_active: boolean;
    profile: { full_name: string | null; email: string } | null;
    professional_services: { service_id: string }[];
}

export default function ProfesionalesPage() {
    const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ProfessionalRow | null>(null);
    const [form, setForm] = useState({
        // Profile fields (only for creation)
        full_name: '', email: '',
        // Professional fields
        specialty: '', license_number: '', bio: '',
        color_code: '#111827', is_active: true,
        selectedServices: [] as string[],
    });

    async function loadData() {
        const [proRes, svcRes, catRes] = await Promise.all([
            supabase.from('professionals').select('*, profile:profiles(full_name, email), professional_services(service_id)'),
            supabase.from('services').select('*').eq('is_active', true).order('name'),
            supabase.from('service_categories').select('*').order('display_order'),
        ]);
        setProfessionals((proRes.data as unknown as ProfessionalRow[]) || []);
        setServices(svcRes.data as Service[] || []);
        setCategories(catRes.data as ServiceCategory[] || []);
        setLoading(false);
    }

    useEffect(() => { loadData(); }, []);

    function openNew() {
        setEditing(null);
        setForm({
            full_name: '', email: '',
            specialty: '', license_number: '', bio: '',
            color_code: '#111827', is_active: true,
            selectedServices: [],
        });
        setShowModal(true);
    }

    function openEdit(p: ProfessionalRow) {
        setEditing(p);
        setForm({
            full_name: p.profile?.full_name || '',
            email: p.profile?.email || '',
            specialty: p.specialty || '',
            license_number: p.license_number || '',
            bio: p.bio || '',
            color_code: p.color_code || '#111827',
            is_active: p.is_active,
            selectedServices: p.professional_services.map(ps => ps.service_id),
        });
        setShowModal(true);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        const profId = editing?.id;

        if (!editing) {
            // New Professional logic
            // Since we need to create an Auth user typically to have a profile, doing it purely client side isn't secure without an Edge Function
            // However, we mock / insert purely what we can in the frontend. If your trigger auto-creates profiles, it needs auth.admin.
            // As a fallback UI, we alert the user that backend logic is needed to create safe auth. 
            alert('Aviso: La creación de un perfil seguro (login) requeriría una Edge Function de backend o invitar al usuario desde Supabase. Sólo se actualizará la UI aquí.');
            return setShowModal(false);
        } else {
            // Update existing professional
            await supabase.from('professionals').update({
                specialty: form.specialty,
                license_number: form.license_number,
                bio: form.bio,
                color_code: form.color_code,
                is_active: form.is_active,
            }).eq('id', profId);

            // Wait, we cannot easily update profiles.full_name here if RLS prevents it for other users without admin key.
            // We'll just update services
            await supabase.from('professional_services').delete().eq('professional_id', profId);
            if (form.selectedServices.length > 0) {
                await supabase.from('professional_services').insert(
                    form.selectedServices.map(sid => ({ professional_id: profId, service_id: sid }))
                );
            }
        }

        setShowModal(false);
        loadData();
    }

    function toggleService(serviceId: string) {
        setForm(f => ({
            ...f,
            selectedServices: f.selectedServices.includes(serviceId)
                ? f.selectedServices.filter(s => s !== serviceId)
                : [...f.selectedServices, serviceId],
        }));
    }

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Profesionales</h1>
                    <p className="page-subtitle">{professionals.length} especialistas registrados en el equipo</p>
                </div>
                <button className="btn btn--primary" onClick={openNew}>
                    <Icon name="plus" size={16} /> Nuevo Profesional
                </button>
            </div>

            <div className="card">
                <div className="card__body" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Perfil</th>
                                    <th>Especialidad & Colegiado</th>
                                    <th>Servicios Habilitados</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {professionals.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%',
                                                    background: 'var(--bg-active)', border: '1px solid var(--border-color)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--text-main)', fontWeight: 600, fontSize: 13,
                                                }}>
                                                    {p.profile?.full_name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.profile?.full_name || 'Sin nombre'}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.profile?.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ color: 'var(--text-main)', fontSize: 14 }}>{p.specialty || 'General'}</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.license_number || 'Sin colegiar'}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {p.professional_services.length === 0 && (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                                                )}
                                                {p.professional_services.map(ps => {
                                                    const svc = services.find(s => s.id === ps.service_id);
                                                    return svc ? (
                                                        <span key={ps.service_id} className="badge badge-default" style={{ fontSize: 10 }}>
                                                            {svc.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${p.is_active ? 'badge--confirmed' : 'badge-default'}`}>
                                                {p.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>
                                                Configurar <Icon name="settings" size={14} style={{ marginLeft: 4 }} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {professionals.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="empty-state">
                                            <div className="empty-state__icon"><Icon name="doctor" size={24} /></div>
                                            <div className="empty-state__title">Sin profesionales</div>
                                            <div className="empty-state__text">Aún no has registrado profesionales en el equipo.</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">{editing ? 'Configurar Perfil Profesional' : 'Nuevo Profesional'}</h3>
                            <button className="modal__close" onClick={() => setShowModal(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal__body">
                                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Datos de Usuario</h4>

                                {!editing && (
                                    <div className="login-error" style={{ marginBottom: 16, fontSize: 12 }}>
                                        <Icon name="warning" size={16} />
                                        <span>
                                            Para asignar un inicio de sesión real, el usuario primero debe crearse desde el panel de Supabase Auth o mediante una Edge Function. Esta UI está preparada para cuando actives ese endpoint.
                                        </span>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Nombre Completo</label>
                                    <input required disabled={!!editing} className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Ej: Dra. María Gómez" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Correo Electrónico</label>
                                    <input type="email" required disabled={!!editing} className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="maria@ejemplo.com" />
                                </div>

                                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 32, marginBottom: 16 }}>Perfil Público</h4>
                                <div className="form-group">
                                    <label className="form-label">Especialidad Principal</label>
                                    <input className="form-input" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Ej: Fisioterapeuta, Psicóloga" />
                                </div>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Nº Colegiado</label>
                                        <input className="form-input" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} placeholder="Ej: CM-12345" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-input form-select" value={form.is_active ? 'yes' : 'no'} onChange={e => setForm({ ...form, is_active: e.target.value === 'yes' })}>
                                            <option value="yes">Activo (Disponible)</option>
                                            <option value="no">Suspendido</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ficha Biográfica</label>
                                    <textarea className="form-input" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Trayectoria, formación técnica..." />
                                </div>

                                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 32, marginBottom: 16 }}>Servicios Habilitados</h4>
                                <div className="form-group" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                                    {categories.map(cat => (
                                        <div key={cat.id} style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed var(--border-color)' }}>
                                                {cat.name}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                                                {services.filter(s => s.category_id === cat.id).map(s => (
                                                    <label key={s.id} className="form-checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.selectedServices.includes(s.id)}
                                                            onChange={() => toggleService(s.id)}
                                                        />
                                                        <span>{s.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {categories.length === 0 && <span className="text-sm text-muted">No hay servicios definidos.</span>}
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn--primary">Confirmar Configuración</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
