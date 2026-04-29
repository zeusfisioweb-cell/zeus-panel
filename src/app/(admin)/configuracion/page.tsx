'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from 'sonner';
import type { BookingSettings } from '@/lib/types';

async function readApiError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { error?: string };
        return body.error || 'Error de servidor';
    } catch {
        return 'Error de servidor';
    }
}

export default function ConfiguracionPage() {
    const [settings, setSettings] = useState<BookingSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        clinic_name: '',
        phone: '',
        email: '',
        address: '',
        booking_advance_days: 30,
        min_booking_notice_hours: 2,
        cancellation_hours: 24,
        slot_interval_minutes: 30,
        buffer_minutes: 10,
        gdpr_text: '',
        informed_consent_text: '',
        privacy_policy_url: '',
        terms_url: '',
        opening_hour: '07:00',
        closing_hour: '20:00',
    });

    const loadSettings = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/booking-settings', {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const data = (await response.json()) as BookingSettings;
            setSettings(data);
            setForm({
                clinic_name: data.clinic_name || '',
                phone: data.phone || '',
                email: data.email || '',
                address: data.address || '',
                booking_advance_days: data.booking_advance_days || 30,
                min_booking_notice_hours: data.min_booking_notice_hours || 2,
                cancellation_hours: data.cancellation_hours || 24,
                slot_interval_minutes: data.slot_interval_minutes || 30,
                buffer_minutes: data.buffer_minutes || 10,
                gdpr_text: data.gdpr_text || '',
                informed_consent_text: data.informed_consent_text || '',
                privacy_policy_url: data.privacy_policy_url || '',
                terms_url: data.terms_url || '',
                opening_hour: data.opening_hour?.substring(0, 5) || '07:00',
                closing_hour: data.closing_hour?.substring(0, 5) || '20:00',
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`Error al cargar la configuración: ${message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!settings) return;

        setSaving(true);
        try {
            const response = await fetch('/api/admin/booking-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    clinic_name: form.clinic_name,
                    phone: form.phone || null,
                    email: form.email || null,
                    address: form.address || null,
                    booking_advance_days: form.booking_advance_days,
                    min_booking_notice_hours: form.min_booking_notice_hours,
                    cancellation_hours: form.cancellation_hours,
                    slot_interval_minutes: form.slot_interval_minutes,
                    buffer_minutes: form.buffer_minutes,
                    gdpr_text: form.gdpr_text || null,
                    informed_consent_text: form.informed_consent_text || null,
                    privacy_policy_url: form.privacy_policy_url || null,
                    terms_url: form.terms_url || null,
                    opening_hour: form.opening_hour,
                    closing_hour: form.closing_hour,
                }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const updated = (await response.json()) as BookingSettings;
            setSettings(updated);
            toast.success('Configuración guardada correctamente');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`Error al guardar: ${message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="spinner" />
            </div>
        );
    }

    const configuredLegalLinks =
        Number(Boolean(form.privacy_policy_url.trim())) + Number(Boolean(form.terms_url.trim()));

    return (
        <div className="content-shell settings-shell ops-screen">
            <header className="zs-cfg-header">
                <div className="zs-cfg-header__top">
                    <div className="zs-cfg-header__lead">
                        <p className="zs-cfg-header__meta">
                            Centro clínico Zeus · gestión de reservas y legal
                        </p>
                    </div>
                </div>

                <div className="zs-cfg-kpi-strip">
                    <div className="zs-cfg-kpi zs-cfg-kpi--canela">
                        <p className="zs-cfg-kpi__label">Apertura / Cierre</p>
                        <p className="zs-cfg-kpi__value">{form.opening_hour.replace(':00','h')}–{form.closing_hour.replace(':00','h')}</p>
                    </div>
                    <div className="zs-cfg-kpi zs-cfg-kpi--neutral">
                        <p className="zs-cfg-kpi__label">Ventana reserva</p>
                        <p className="zs-cfg-kpi__value">{form.booking_advance_days} días</p>
                    </div>
                    <div className="zs-cfg-kpi zs-cfg-kpi--neutral">
                        <p className="zs-cfg-kpi__label">Aviso mínimo</p>
                        <p className="zs-cfg-kpi__value">{form.min_booking_notice_hours} h</p>
                    </div>
                    <div className={`zs-cfg-kpi ${configuredLegalLinks === 2 ? 'zs-cfg-kpi--success' : 'zs-cfg-kpi--warning'}`}>
                        <p className="zs-cfg-kpi__label">Legal OK</p>
                        <p className="zs-cfg-kpi__value">{configuredLegalLinks}/2</p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="settings-layout">
                <div className="settings-main">
                    <section className="bento-card settings-panel">
                        <div className="settings-panel__head">
                            <span className="settings-panel__icon">
                                <Icon name="building" size={18} />
                            </span>
                            <div>
                                <h2 className="settings-panel__title"><span className="zs-cfg-num">01</span> Datos de la clínica</h2>
                                <p className="settings-panel__desc">Datos visibles en panel y reservas.</p>
                            </div>
                        </div>

                        <div className="settings-fields settings-fields--2">
                            <label className="settings-field">
                                <span className="form-label">Nombre de la clínica</span>
                                <input
                                    className="form-input"
                                    value={form.clinic_name}
                                    onChange={e => setForm({ ...form, clinic_name: e.target.value })}
                                    required
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">Teléfono</span>
                                <input
                                    className="form-input"
                                    value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+34 600 000 000"
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">Email</span>
                                <input
                                    className="form-input"
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="clínica@email.com"
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">Dirección</span>
                                <input
                                    className="form-input"
                                    value={form.address}
                                    onChange={e => setForm({ ...form, address: e.target.value })}
                                    placeholder="Calle, número, ciudad"
                                />
                            </label>
                        </div>
                    </section>

                    <section className="bento-card settings-panel">
                        <div className="settings-panel__head">
                            <span className="settings-panel__icon">
                                <Icon name="calendar" size={18} />
                            </span>
                            <div>
                                <h2 className="settings-panel__title"><span className="zs-cfg-num">02</span> Reservas online</h2>
                                <p className="settings-panel__desc">Reglas base de agenda y antelación.</p>
                            </div>
                        </div>

                        <div className="settings-fields settings-fields--2">
                            <label className="settings-field">
                                <span className="form-label">Apertura</span>
                                <input
                                    className="form-input"
                                    type="time"
                                    value={form.opening_hour}
                                    onChange={e => setForm({ ...form, opening_hour: e.target.value })}
                                />
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Cierre</span>
                                <input
                                    className="form-input"
                                    type="time"
                                    value={form.closing_hour}
                                    onChange={e => setForm({ ...form, closing_hour: e.target.value })}
                                />
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Reservar con antelación (días)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={form.booking_advance_days}
                                    onChange={e => setForm({ ...form, booking_advance_days: +e.target.value })}
                                />
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Aviso mínimo (horas)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    max={72}
                                    value={form.min_booking_notice_hours}
                                    onChange={e => setForm({ ...form, min_booking_notice_hours: +e.target.value })}
                                />
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Cancelación (horas)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    max={72}
                                    value={form.cancellation_hours}
                                    onChange={e => setForm({ ...form, cancellation_hours: +e.target.value })}
                                />
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Intervalo de huecos (min)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={5}
                                    max={120}
                                    step={5}
                                    value={form.slot_interval_minutes}
                                    onChange={e => setForm({ ...form, slot_interval_minutes: +e.target.value })}
                                />
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Buffer entre citas (min)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    max={60}
                                    step={5}
                                    value={form.buffer_minutes}
                                    onChange={e => setForm({ ...form, buffer_minutes: +e.target.value })}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="bento-card settings-panel">
                        <div className="settings-panel__head">
                            <span className="settings-panel__icon">
                                <Icon name="scale" size={18} />
                            </span>
                            <div>
                                <h2 className="settings-panel__title"><span className="zs-cfg-num">03</span> Legal y consentimientos</h2>
                                <p className="settings-panel__desc">Textos y enlaces que ve el paciente al reservar.</p>
                            </div>
                        </div>

                        <div className="settings-fields settings-fields--2">
                            <label className="settings-field">
                                <span className="form-label">URL política de privacidad</span>
                                <input
                                    className="form-input"
                                    type="url"
                                    value={form.privacy_policy_url}
                                    onChange={e => setForm({ ...form, privacy_policy_url: e.target.value })}
                                    placeholder="https://..."
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">URL términos y condiciones</span>
                                <input
                                    className="form-input"
                                    type="url"
                                    value={form.terms_url}
                                    onChange={e => setForm({ ...form, terms_url: e.target.value })}
                                    placeholder="https://..."
                                />
                            </label>
                            <label className="settings-field settings-field--full">
                                <span className="form-label">Texto RGPD / LOPDGDD</span>
                                <textarea
                                    className="form-input settings-textarea"
                                    value={form.gdpr_text}
                                    onChange={e => setForm({ ...form, gdpr_text: e.target.value })}
                                    rows={5}
                                    placeholder="Texto de protección de datos que se muestra al paciente..."
                                />
                            </label>
                            <label className="settings-field settings-field--full">
                                <span className="form-label">Texto de consentimiento informado</span>
                                <textarea
                                    className="form-input settings-textarea"
                                    value={form.informed_consent_text}
                                    onChange={e => setForm({ ...form, informed_consent_text: e.target.value })}
                                    rows={5}
                                    placeholder="Texto de consentimiento informado según Ley 41/2002..."
                                />
                            </label>
                        </div>
                    </section>
                </div>

                <aside className="settings-aside">
                    <div className="bento-card settings-summary-card">
                        <h3>Revisión rápida</h3>
                        <p>Solo lo esencial antes de guardar.</p>
                        <div className="settings-summary-list">
                            <div className="settings-summary-item">
                                <span>Horario visible</span>
                                <strong>{form.opening_hour} - {form.closing_hour}</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Ventana de reserva</span>
                                <strong>{form.booking_advance_days} días</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Ritmo de agenda</span>
                                <strong>{form.slot_interval_minutes} min + {form.buffer_minutes} min buffer</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Enlaces legales</span>
                                <strong>{configuredLegalLinks}/2</strong>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card settings-save-card">
                        <p>Los cambios se aplican al panel y a las reservas online.</p>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn btn--primary settings-save-button"
                        >
                            <Icon name="save" size={16} />
                            {saving ? 'Guardando...' : 'Guardar configuración'}
                        </button>
                    </div>
                </aside>
            </form>
        </div>
    );
}
