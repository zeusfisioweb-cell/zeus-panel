'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i;

interface Dependiente {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string | null;
    age: number | null;
    approaching_autonomy: boolean;
    autonomous: boolean;
    document_id: string | null;
}

interface DependientesClientProps {
    dependientes: Dependiente[];
}

export function DependientesClient({ dependientes: initial }: DependientesClientProps) {
    const router = useRouter();
    const [list, setList] = useState<Dependiente[]>(initial);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [fields, setFields] = useState({
        first_name: '',
        last_name: '',
        birth_date: '',
        phone: '',
        document_id: '',
        gdpr_consented_by_guardian: false,
    });

    function update(key: keyof typeof fields, value: string | boolean) {
        setFields(prev => ({ ...prev, [key]: value }));
    }

    function getAge(birthDate: string): number {
        const today = new Date();
        const dob = new Date(birthDate);
        let age = today.getFullYear() - dob.getFullYear();
        if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
        return age;
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!fields.gdpr_consented_by_guardian) {
            setError('Debes aceptar el consentimiento como tutor legal.');
            return;
        }
        if (!fields.birth_date) {
            setError('La fecha de nacimiento es obligatoria.');
            return;
        }
        const age = getAge(fields.birth_date);
        if (age >= 16) {
            setError('El dependiente tiene 16 años o más. Debe registrarse de forma independiente.');
            return;
        }
        if (fields.document_id && !DNI_NIE_REGEX.test(fields.document_id.trim())) {
            setError('Formato DNI/NIE inválido (ej: 12345678A).');
            return;
        }

        setError('');
        setSubmitting(true);

        const res = await fetch('/api/portal/dependientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                first_name: fields.first_name.trim(),
                last_name: fields.last_name.trim(),
                birth_date: fields.birth_date,
                phone: fields.phone.trim() || undefined,
                document_id: fields.document_id.trim() || undefined,
                gdpr_consented_by_guardian: fields.gdpr_consented_by_guardian,
            }),
        });

        const json = await res.json();
        setSubmitting(false);

        if (!res.ok) {
            setError(json.error ?? 'Error al añadir dependiente.');
            return;
        }

        setShowForm(false);
        setFields({ first_name: '', last_name: '', birth_date: '', phone: '', document_id: '', gdpr_consented_by_guardian: false });
        router.refresh();
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`¿Eliminar a ${name} de tus dependientes? Sus citas existentes no se cancelarán.`)) return;

        const res = await fetch(`/api/portal/dependientes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setList(prev => prev.filter(d => d.id !== id));
            router.refresh();
        }
    }

    const today = new Date().toISOString().split('T')[0];
    const maxDate = today;

    return (
        <div>
            <div className="portal-section__head" style={{ marginBottom: '1rem' }}>
                <h2 className="portal-section__title">Mis dependientes</h2>
                {!showForm && (
                    <button
                        className="btn btn--primary btn--sm"
                        onClick={() => setShowForm(true)}
                    >
                        + Añadir hijo/a
                    </button>
                )}
            </div>

            {showForm && (
                <form className="portal-onboarding__form" onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Nuevo dependiente</h3>

                    {error && <div className="login-error" role="alert">{error}</div>}

                    <div className="portal-onboarding__row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="dep-first-name">Nombre *</label>
                            <input id="dep-first-name" type="text" className="form-input"
                                value={fields.first_name} onChange={e => update('first_name', e.target.value)}
                                required autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="dep-last-name">Apellidos *</label>
                            <input id="dep-last-name" type="text" className="form-input"
                                value={fields.last_name} onChange={e => update('last_name', e.target.value)}
                                required />
                        </div>
                    </div>

                    <div className="portal-onboarding__row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="dep-birth">Fecha de nacimiento *</label>
                            <input id="dep-birth" type="date" className="form-input"
                                value={fields.birth_date} onChange={e => update('birth_date', e.target.value)}
                                required max={maxDate} />
                            <span className="form-label__hint">Solo menores de 16 años</span>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="dep-phone">Teléfono</label>
                            <input id="dep-phone" type="tel" className="form-input" placeholder="600 000 000"
                                value={fields.phone} onChange={e => update('phone', e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="dep-dni">
                            DNI / NIE
                            <span className="form-label__hint"> — opcional, añádelo si ya lo tiene (mayores de 14)</span>
                        </label>
                        <input id="dep-dni" type="text" className="form-input" placeholder="12345678A"
                            value={fields.document_id} onChange={e => update('document_id', e.target.value)}
                            autoComplete="off" />
                    </div>

                    <label className="portal-onboarding__gdpr">
                        <input type="checkbox" checked={fields.gdpr_consented_by_guardian}
                            onChange={e => update('gdpr_consented_by_guardian', e.target.checked)} required />
                        <span>
                            Como tutor legal, consiento el tratamiento de los datos de mi hijo/a para la gestión de citas médicas
                            (Ley 41/2002 y LOPDGDD Art. 7).
                        </span>
                    </label>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button type="submit" className="btn btn--primary" disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Añadir dependiente'}
                        </button>
                        <button type="button" className="btn btn--ghost" onClick={() => { setShowForm(false); setError(''); }}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {list.length === 0 && !showForm ? (
                <div className="portal-empty">
                    <p>No tienes dependientes registrados.</p>
                    <p className="portal-empty__hint">
                        Añade a tus hijos menores de 16 años para gestionar sus citas.
                    </p>
                </div>
            ) : (
                <ul className="portal-apt-list" style={{ listStyle: 'none', padding: 0 }}>
                    {list.map(dep => (
                        <li key={dep.id} className="portal-apt-card" style={{ padding: '1rem 1.25rem' }}>
                            <div className="portal-apt-card__body">
                                <div>
                                    <strong>{dep.first_name} {dep.last_name}</strong>
                                    {dep.age !== null && (
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {dep.age} años
                                        </span>
                                    )}
                                    {dep.approaching_autonomy && !dep.autonomous && (
                                        <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                                            Próximo a autonomía sanitaria
                                        </span>
                                    )}
                                    {!dep.document_id && dep.age !== null && dep.age >= 14 && (
                                        <p style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '0.25rem' }}>
                                            Sin DNI registrado — añádelo para facilitar el acceso al portal cuando cumpla 16
                                        </p>
                                    )}
                                </div>
                                <button
                                    className="btn btn--ghost btn--sm"
                                    style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
                                    onClick={() => handleDelete(dep.id, `${dep.first_name} ${dep.last_name}`)}
                                >
                                    Eliminar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
