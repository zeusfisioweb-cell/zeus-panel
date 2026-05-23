'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { toast } from 'sonner';
import type { BookingSettings } from '@/lib/types';
import { readApiError } from '@/lib/api-helpers';
import { NotificationsSettings } from '@/components/NotificationsSettings';


export default function ConfiguracionPage() {
    const [settings, setSettings] = useState<BookingSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        clinic_name: '',
        min_booking_notice_hours: 2,
        cancellation_hours: 24,
        slot_interval_minutes: 30,
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
                min_booking_notice_hours: data.min_booking_notice_hours || 2,
                cancellation_hours: data.cancellation_hours || 24,
                slot_interval_minutes: data.slot_interval_minutes || 30,
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
                    min_booking_notice_hours: form.min_booking_notice_hours,
                    cancellation_hours: form.cancellation_hours,
                    slot_interval_minutes: form.slot_interval_minutes,
                    buffer_minutes: 0,
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

    return (
        <div className="content-shell settings-shell ops-screen" data-testid="settings-page">
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl space-y-4">
                <section className="bento-card p-5 md:p-6">
                    <div className="mb-4">
                        <h1 className="text-lg font-semibold tracking-[-0.01em]">Configuración</h1>
                        <p className="text-sm text-[var(--text-muted)]">Solo campos operativos.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label>
                            <span className="form-label">Nombre de la clínica</span>
                            <input
                                className="form-input"
                                value={form.clinic_name}
                                onChange={e => setForm({ ...form, clinic_name: e.target.value })}
                                required
                                minLength={1}
                            />
                        </label>
                        <label>
                            <span className="form-label">Apertura</span>
                            <input
                                className="form-input"
                                type="time"
                                value={form.opening_hour}
                                onChange={e => setForm({ ...form, opening_hour: e.target.value })}
                            />
                        </label>
                        <label>
                            <span className="form-label">Cierre</span>
                            <input
                                className="form-input"
                                type="time"
                                value={form.closing_hour}
                                onChange={e => setForm({ ...form, closing_hour: e.target.value })}
                            />
                        </label>
                        <label>
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
                        <label>
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
                        <label>
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
                    </div>
                </section>

                <NotificationsSettings />

                <section className="bento-card flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                    <p className="text-sm text-[var(--text-muted)]">Los cambios se aplican al panel y a las reservas online.</p>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn--primary settings-save-button"
                    >
                        <Icon name="save" size={16} />
                        {saving ? 'Guardando...' : 'Guardar configuración'}
                    </button>
                </section>
            </form>
        </div>
    );
}
