'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();
import type { BookingSettings } from '@/lib/types';

export default function ConfiguracionPage() {
    const [settings, setSettings] = useState<BookingSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const loadSettings = useCallback(async () => {
        const { data } = await supabase.from('booking_settings').select('*').limit(1).single();
        setSettings(data as BookingSettings | null);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!settings) return;
        setSaving(true);
        setSaved(false);

        await supabase
            .from('booking_settings')
            .update({
                clinic_name: settings.clinic_name,
                phone: settings.phone,
                email: settings.email,
                address: settings.address,
                booking_advance_days: settings.booking_advance_days,
                min_booking_notice_hours: settings.min_booking_notice_hours,
                cancellation_hours: settings.cancellation_hours,
                slot_interval_minutes: settings.slot_interval_minutes,
                buffer_minutes: settings.buffer_minutes,
                gdpr_text: settings.gdpr_text,
                informed_consent_text: settings.informed_consent_text,
                privacy_policy_url: settings.privacy_policy_url,
                terms_url: settings.terms_url,
            })
            .eq('id', settings.id);

        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    }

    function updateField(field: keyof BookingSettings, value: string | number) {
        setSettings(s => s ? { ...s, [field]: value } : null);
    }

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;
    if (!settings) return <div className="empty-state"><p>No se encontró configuración</p></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configuración</h1>
                    <p className="page-subtitle">Ajustes generales de la clínica y reservas</p>
                </div>
                {saved && (
                    <span className="badge badge--confirmed" style={{ fontSize: 13, padding: '6px 14px' }}>
                        ✓ Guardado correctamente
                    </span>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Datos de la clínica */}
                    <div className="card">
                        <div className="card__header">
                            <h2 className="card__title"><Icon name="building" size={18} /> Datos de la clínica</h2>
                        </div>
                        <div className="card__body">
                            <div className="form-group">
                                <label className="form-label">Nombre</label>
                                <input className="form-input" value={settings.clinic_name || ''} onChange={e => updateField('clinic_name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono</label>
                                <input className="form-input" value={settings.phone || ''} onChange={e => updateField('phone', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" value={settings.email || ''} onChange={e => updateField('email', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección</label>
                                <input className="form-input" value={settings.address || ''} onChange={e => updateField('address', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Reglas de reserva */}
                    <div className="card">
                        <div className="card__header">
                            <h2 className="card__title"><Icon name="calendar" size={18} /> Reglas de reserva</h2>
                        </div>
                        <div className="card__body">
                            <div className="form-group">
                                <label className="form-label">Días máximos de antelación</label>
                                <input type="number" className="form-input" value={settings.booking_advance_days} onChange={e => updateField('booking_advance_days', +e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Aviso mínimo (horas)</label>
                                <input type="number" className="form-input" value={settings.min_booking_notice_hours} onChange={e => updateField('min_booking_notice_hours', +e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cancelación gratuita (horas)</label>
                                <input type="number" className="form-input" value={settings.cancellation_hours} onChange={e => updateField('cancellation_hours', +e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Intervalo slots (min)</label>
                                    <input type="number" className="form-input" value={settings.slot_interval_minutes} onChange={e => updateField('slot_interval_minutes', +e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Buffer entre citas (min)</label>
                                    <input type="number" className="form-input" value={settings.buffer_minutes} onChange={e => updateField('buffer_minutes', +e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Textos legales */}
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                        <div className="card__header">
                            <h2 className="card__title"><Icon name="scale" size={18} /> Textos legales (LOPD / RGPD)</h2>
                        </div>
                        <div className="card__body">
                            {/* Warning if legal texts are incomplete */}
                            {(!settings.gdpr_text || !settings.informed_consent_text || !settings.privacy_policy_url) && (
                                <div style={{
                                    background: 'rgba(234, 179, 8, 0.1)',
                                    border: '1px solid rgba(234, 179, 8, 0.4)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px',
                                    marginBottom: 20,
                                    display: 'flex',
                                    gap: 12,
                                    alignItems: 'flex-start',
                                    fontSize: 13,
                                }}>
                                    <Icon name="warning" size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Textos legales incompletos</div>
                                        <div style={{ color: 'var(--gris)', lineHeight: 1.5 }}>
                                            Para cumplir con la <strong>LOPD</strong> y el <strong>RGPD (Reglamento UE 2016/679)</strong>, debes configurar el texto de consentimiento RGPD, el consentimiento informado (Ley 41/2002) y la URL de tu política de privacidad antes de activar el sistema de reservas online.
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label" htmlFor="gdpr_text">Texto de consentimiento RGPD *</label>
                                <textarea id="gdpr_text" className="form-input" rows={5} value={settings.gdpr_text || ''} onChange={e => updateField('gdpr_text', e.target.value)} placeholder="Ej: De acuerdo con el Reglamento (UE) 2016/679, le informamos que sus datos personales serán tratados por…" />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="informed_consent_text">Texto de consentimiento informado (Ley 41/2002) *</label>
                                <textarea id="informed_consent_text" className="form-input" rows={5} value={settings.informed_consent_text || ''} onChange={e => updateField('informed_consent_text', e.target.value)} placeholder="Ej: El paciente ha sido informado de forma comprensible sobre su estado de salud, el tratamiento propuesto…" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="privacy_policy_url">URL Política de Privacidad *</label>
                                    <input id="privacy_policy_url" className="form-input" value={settings.privacy_policy_url || ''} onChange={e => updateField('privacy_policy_url', e.target.value)} placeholder="https://tusitioweb.es/privacidad" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="terms_url">URL Términos y Condiciones</label>
                                    <input id="terms_url" className="form-input" value={settings.terms_url || ''} onChange={e => updateField('terms_url', e.target.value)} placeholder="https://tusitioweb.es/terminos" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn--primary btn--lg" disabled={saving}>
                        {saving ? (
                            <>
                                <div className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                                Guardando...
                            </>
                        ) : (
                            <><Icon name="save" size={14} /> Guardar configuración</>
                        )}
                    </button>
                </div>
            </form>
        </>
    );
}
