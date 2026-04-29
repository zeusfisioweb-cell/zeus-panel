'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i;

interface CompleteProfileFormProps {
    userEmail: string;
}

export function CompleteProfileForm({ userEmail }: CompleteProfileFormProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [fields, setFields] = useState({
        first_name: '',
        last_name: '',
        document_id: '',
        phone: '',
        birth_date: '',
        gdpr_consent: false,
    });

    function update(key: keyof typeof fields, value: string | boolean) {
        setFields(prev => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!fields.gdpr_consent) {
            setError('Debes aceptar la política de privacidad para continuar.');
            return;
        }
        if (!fields.birth_date) {
            setError('La fecha de nacimiento es obligatoria.');
            return;
        }
        const dob = new Date(fields.birth_date);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
        if (age < 16) {
            setError('Los menores de 16 años no pueden registrarse de forma independiente. Pide a tu tutor legal que te añada como dependiente desde su cuenta.');
            return;
        }
        if (!DNI_NIE_REGEX.test(fields.document_id.trim())) {
            setError('DNI / NIE inválido. Formato esperado: 12345678A (8 dígitos + letra) o X1234567A (NIE).');
            return;
        }
        setError('');
        setSubmitting(true);

        const res = await fetch('/api/portal/complete-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                first_name: fields.first_name.trim(),
                last_name: fields.last_name.trim(),
                document_id: fields.document_id.trim(),
                phone: fields.phone.trim() || undefined,
                birth_date: fields.birth_date || undefined,
                gdpr_consent: fields.gdpr_consent,
            }),
        });

        const json = await res.json();
        setSubmitting(false);

        if (!res.ok) {
            setError(json.error ?? 'Error al guardar el perfil. Inténtalo de nuevo.');
            return;
        }

        router.push('/portal/mis-citas');
        router.refresh();
    }

    return (
        <form className="portal-onboarding__form" onSubmit={handleSubmit}>
            {userEmail && (
                <div className="portal-onboarding__email-hint">
                    Cuenta: <strong>{userEmail}</strong>
                </div>
            )}

            {error && (
                <div className="login-error" role="alert">{error}</div>
            )}

            <div className="portal-onboarding__row">
                <div className="form-group">
                    <label className="form-label" htmlFor="cp-first-name">Nombre *</label>
                    <input
                        id="cp-first-name"
                        type="text"
                        className="form-input"
                        value={fields.first_name}
                        onChange={e => update('first_name', e.target.value)}
                        required
                        autoFocus
                        autoComplete="given-name"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="cp-last-name">Apellidos *</label>
                    <input
                        id="cp-last-name"
                        type="text"
                        className="form-input"
                        value={fields.last_name}
                        onChange={e => update('last_name', e.target.value)}
                        required
                        autoComplete="family-name"
                    />
                </div>
            </div>

            <div className="portal-onboarding__row">
                <div className="form-group">
                    <label className="form-label" htmlFor="cp-dni">DNI / NIE *</label>
                    <input
                        id="cp-dni"
                        type="text"
                        className="form-input"
                        placeholder="12345678A"
                        value={fields.document_id}
                        onChange={e => update('document_id', e.target.value)}
                        required
                        autoComplete="off"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="cp-phone">Teléfono</label>
                    <input
                        id="cp-phone"
                        type="tel"
                        className="form-input"
                        placeholder="600 000 000"
                        value={fields.phone}
                        onChange={e => update('phone', e.target.value)}
                        autoComplete="tel"
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="cp-birth">Fecha de nacimiento *</label>
                <input
                    id="cp-birth"
                    type="date"
                    className="form-input"
                    value={fields.birth_date}
                    onChange={e => update('birth_date', e.target.value)}
                    required
                    max={new Date().toISOString().split('T')[0]}
                />
            </div>

            <label className="portal-onboarding__gdpr">
                <input
                    type="checkbox"
                    checked={fields.gdpr_consent}
                    onChange={e => update('gdpr_consent', e.target.checked)}
                    required
                />
                <span>
                    Acepto la <a href="#" target="_blank" rel="noopener">política de privacidad</a> y
                    el tratamiento de mis datos para la gestión de citas médicas.
                </span>
            </label>

            <button
                type="submit"
                className="btn btn--primary btn--lg portal-login-btn"
                disabled={submitting}
            >
                {submitting ? (
                    <>
                        <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                        Guardando...
                    </>
                ) : (
                    'Acceder al portal'
                )}
            </button>
        </form>
    );
}
