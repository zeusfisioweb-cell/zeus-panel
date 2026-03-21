'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import { toast } from 'sonner';
import type { BookingSettings } from '@/lib/types';

export default function ConfiguracionPage() {
    const [supabase] = useState(() => createClient());

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
        const { data, error } = await supabase
            .from('booking_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            toast.error('Error al cargar la configuracion');
            setLoading(false);
            return;
        }

        setSettings(data as BookingSettings);
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

        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        const { error } = await supabase
            .from('booking_settings')
            .update({
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
            })
            .eq('id', settings.id);

        setSaving(false);
        if (error) {
            toast.error('Error al guardar: ' + error.message);
        } else {
            toast.success('Configuracion guardada correctamente');
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
        <div className="content-shell settings-shell">
            <header className="module-header module-header--settings">
                <div>
                    <span className="module-header__kicker">Ajustes</span>
                    <h1 className="module-header__title">Configuracion</h1>
                    <p className="module-header__desc">
                        Parametros generales de agenda, reservas y textos legales para la operacion diaria.
                    </p>
                    <p className="module-header__meta">
                        Ventana de reserva: {form.booking_advance_days} dias | Intervalo: {form.slot_interval_minutes} min
                    </p>
                </div>
                <div className="module-header__actions settings-header__chips">
                    <div className="settings-header-chip">
                        <span>Horario</span>
                        <strong>{form.opening_hour} - {form.closing_hour}</strong>
                    </div>
                    <div className="settings-header-chip">
                        <span>Aviso minimo</span>
                        <strong>{form.min_booking_notice_hours} h</strong>
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
                                <h2 className="settings-panel__title">Datos de la clinica</h2>
                                <p className="settings-panel__desc">Informacion visible para pacientes y comunicaciones.</p>
                            </div>
                        </div>

                        <div className="settings-fields settings-fields--2">
                            <label className="settings-field">
                                <span className="form-label">Nombre de la clinica</span>
                                <input
                                    className="form-input"
                                    value={form.clinic_name}
                                    onChange={e => setForm({ ...form, clinic_name: e.target.value })}
                                    required
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">Telefono</span>
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
                                    placeholder="clinica@email.com"
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">Direccion</span>
                                <input
                                    className="form-input"
                                    value={form.address}
                                    onChange={e => setForm({ ...form, address: e.target.value })}
                                    placeholder="Calle, numero, ciudad"
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
                                <h2 className="settings-panel__title">Reservas online</h2>
                                <p className="settings-panel__desc">Controla reglas de agenda para mantener disponibilidad realista.</p>
                            </div>
                        </div>

                        <div className="settings-fields settings-fields--3">
                            <label className="settings-field">
                                <span className="form-label">Apertura</span>
                                <input
                                    className="form-input"
                                    type="time"
                                    value={form.opening_hour}
                                    onChange={e => setForm({ ...form, opening_hour: e.target.value })}
                                />
                                <span className="settings-help">Hora de inicio de agenda</span>
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Cierre</span>
                                <input
                                    className="form-input"
                                    type="time"
                                    value={form.closing_hour}
                                    onChange={e => setForm({ ...form, closing_hour: e.target.value })}
                                />
                                <span className="settings-help">Hora final de agenda</span>
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Reservar con antelacion (dias)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={form.booking_advance_days}
                                    onChange={e => setForm({ ...form, booking_advance_days: +e.target.value })}
                                />
                                <span className="settings-help">Maximo de dias en el futuro</span>
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Aviso minimo (horas)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    max={72}
                                    value={form.min_booking_notice_hours}
                                    onChange={e => setForm({ ...form, min_booking_notice_hours: +e.target.value })}
                                />
                                <span className="settings-help">Horas minimas antes de la cita</span>
                            </label>

                            <label className="settings-field">
                                <span className="form-label">Cancelacion (horas)</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    max={72}
                                    value={form.cancellation_hours}
                                    onChange={e => setForm({ ...form, cancellation_hours: +e.target.value })}
                                />
                                <span className="settings-help">Limite para cancelar sin penalizacion</span>
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
                                <span className="settings-help">Frecuencia para generar huecos</span>
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
                                <span className="settings-help">Margen entre citas consecutivas</span>
                            </label>
                        </div>
                    </section>

                    <section className="bento-card settings-panel">
                        <div className="settings-panel__head">
                            <span className="settings-panel__icon">
                                <Icon name="scale" size={18} />
                            </span>
                            <div>
                                <h2 className="settings-panel__title">Legal y consentimientos</h2>
                                <p className="settings-panel__desc">Textos y enlaces que se muestran en el flujo de reserva.</p>
                            </div>
                        </div>

                        <div className="settings-fields settings-fields--2">
                            <label className="settings-field">
                                <span className="form-label">URL politica de privacidad</span>
                                <input
                                    className="form-input"
                                    type="url"
                                    value={form.privacy_policy_url}
                                    onChange={e => setForm({ ...form, privacy_policy_url: e.target.value })}
                                    placeholder="https://..."
                                />
                            </label>
                            <label className="settings-field">
                                <span className="form-label">URL terminos y condiciones</span>
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
                                    placeholder="Texto de proteccion de datos que se muestra al paciente..."
                                />
                            </label>
                            <label className="settings-field settings-field--full">
                                <span className="form-label">Texto de consentimiento informado</span>
                                <textarea
                                    className="form-input settings-textarea"
                                    value={form.informed_consent_text}
                                    onChange={e => setForm({ ...form, informed_consent_text: e.target.value })}
                                    rows={5}
                                    placeholder="Texto de consentimiento informado segun Ley 41/2002..."
                                />
                            </label>
                        </div>
                    </section>
                </div>

                <aside className="settings-aside">
                    <div className="bento-card settings-summary-card">
                        <h3>Resumen operativo</h3>
                        <p>Revision rapida de parametros clave antes de guardar.</p>
                        <div className="settings-summary-list">
                            <div className="settings-summary-item">
                                <span>Horario visible</span>
                                <strong>{form.opening_hour} - {form.closing_hour}</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Ventana de reserva</span>
                                <strong>{form.booking_advance_days} dias</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Aviso minimo</span>
                                <strong>{form.min_booking_notice_hours} h</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Duracion de hueco</span>
                                <strong>{form.slot_interval_minutes} min</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Buffer</span>
                                <strong>{form.buffer_minutes} min</strong>
                            </div>
                            <div className="settings-summary-item">
                                <span>Enlaces legales</span>
                                <strong>{configuredLegalLinks}/2</strong>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card settings-save-card">
                        <p>Cuando guardes, los cambios se aplicaran en todo el panel y en reservas online.</p>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn btn--primary settings-save-button"
                        >
                            <Icon name="save" size={16} />
                            {saving ? 'Guardando...' : 'Guardar configuracion'}
                        </button>
                    </div>
                </aside>
            </form>
        </div>
    );
}
