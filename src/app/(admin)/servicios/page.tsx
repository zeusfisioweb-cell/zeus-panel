'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { Service, ServiceCategory } from '@/lib/types';

export default function ServiciosPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Service | null>(null);
    const [form, setForm] = useState({
        name: '', description: '', duration_minutes: 50, price: 0,
        category_id: '', is_active: true,
    });

    const loadData = useCallback(async () => {
        const [servicesRes, categoriesRes] = await Promise.all([
            supabase.from('services').select('*, category:service_categories(*)').order('name'),
            supabase.from('service_categories').select('*').order('display_order'),
        ]);
        setServices(servicesRes.data as Service[] || []);
        setCategories(categoriesRes.data as ServiceCategory[] || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    function openNew() {
        setEditing(null);
        setForm({ name: '', description: '', duration_minutes: 50, price: 0, category_id: categories[0]?.id || '', is_active: true });
        setShowModal(true);
    }

    function openEdit(s: Service) {
        setEditing(s);
        setForm({
            name: s.name,
            description: s.description || '',
            duration_minutes: s.duration_minutes,
            price: Number(s.price),
            category_id: s.category_id || '',
            is_active: s.is_active,
        });
        setShowModal(true);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const payload = { ...form, price: Number(form.price) };

        if (editing) {
            await supabase.from('services').update(payload).eq('id', editing.id);
        } else {
            await supabase.from('services').insert(payload);
        }
        setShowModal(false);
        loadData();
    }

    async function deleteService(id: string) {
        if (!confirm('¿Eliminar de forma permanente este servicio?')) return;
        await supabase.from('services').delete().eq('id', id);
        loadData();
    }

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const grouped = categories.map(cat => ({
        category: cat,
        services: services.filter(s => s.category_id === cat.id),
    }));

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Servicios</h1>
                    <p className="page-subtitle">{services.length} servicios en {categories.length} categorías</p>
                </div>
                <button className="btn btn--primary" onClick={openNew}>
                    <Icon name="plus" size={16} /> Nuevo
                </button>
            </div>

            {grouped.map(({ category, services: catServices }) => (
                <div key={category.id} className="card" style={{ marginBottom: 24 }}>
                    <div className="card__header">
                        <h2 className="card__title" style={{ fontSize: 16 }}>
                            {category.name}
                        </h2>
                        <span className="badge badge-default">
                            {catServices.length} servicios
                        </span>
                    </div>
                    <div className="card__body" style={{ padding: 0 }}>
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Servicio</th>
                                        <th>Duración / Precio</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {catServices.map(s => (
                                        <tr key={s.id}>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 14 }}>{s.name}</div>
                                                {s.description && (
                                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, marginTop: 4 }}>
                                                        {s.description.length > 80 ? s.description.substring(0, 80) + '...' : s.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{Number(s.price).toFixed(0)}€</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.duration_minutes} min</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${s.is_active ? 'badge--confirmed' : 'badge-default'}`}>
                                                    {s.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                    <button className="btn btn--ghost btn--sm" onClick={() => openEdit(s)}><Icon name="edit" size={16} /></button>
                                                    <button className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)' }} onClick={() => deleteService(s.id)}><Icon name="trash" size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {catServices.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="empty-state">
                                                <div className="empty-state__icon"><Icon name="spa" size={20} /></div>
                                                <div className="empty-state__title">Sin servicios</div>
                                                <div className="empty-state__text">No hay servicios en esta categoría.</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ))}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">{editing ? 'Configurar Servicio' : 'Nuevo Servicio'}</h3>
                            <button className="modal__close" onClick={() => setShowModal(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal__body">
                                <div className="form-group">
                                    <label className="form-label">Nombre del servicio</label>
                                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Fisioterapia Avanzada" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripción</label>
                                    <textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalles visibles en la web..." />
                                </div>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Duración (minutos)</label>
                                        <input type="number" className="form-input" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Precio (€)</label>
                                        <input type="number" className="form-input" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Categoría</label>
                                        <select className="form-input form-select" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} required>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-input form-select" value={form.is_active ? 'yes' : 'no'} onChange={e => setForm({ ...form, is_active: e.target.value === 'yes' })}>
                                            <option value="yes">Activo (Público)</option>
                                            <option value="no">Suspendido (Privado)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn--primary">{editing ? 'Guardar Cambios' : 'Crear Servicio'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
