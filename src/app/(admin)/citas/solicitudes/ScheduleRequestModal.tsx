'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { readApiError } from '@/lib/api-helpers';
import type { AppointmentRequest } from '@/hooks/useAppointmentRequests';

interface Props {
    request: AppointmentRequest;
    onSuccess: () => void;
    onCancel: () => void;
}

function formatDateLong(iso: string): string {
    const date = new Date(`${iso}T00:00:00`);
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Madrid',
    }).format(date);
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map((p) => parseInt(p, 10));
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${pad(nh)}:${pad(nm)}`;
}

function buildLocalIso(date: string, time: string): string {
    // Browser TZ assumed = Europe/Madrid (admin in clinic). Date constructor
    // interprets the literal as local time, toISOString returns UTC.
    return new Date(`${date}T${time}:00`).toISOString();
}

export function ScheduleRequestModal({ request, onSuccess, onCancel }: Props) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const [startTime, setStartTime] = useState('10:00');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const duration = request.service_duration_minutes ?? 30;
    const endTime = addMinutesToTime(startTime, duration);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting) onCancel();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onCancel, submitting]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (submitting) return;
        setError(null);
        setSubmitting(true);
        try {
            const startIso = buildLocalIso(request.preferred_date, startTime);
            const endIso = buildLocalIso(request.preferred_date, endTime);

            const createRes = await fetch('/api/admin/appointments', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: request.patient_id,
                    professional_id: request.professional_id,
                    service_id: request.service_id,
                    start_time: startIso,
                    end_time: endIso,
                    status: 'confirmed',
                    notes: request.notes ?? null,
                }),
            });
            if (!createRes.ok) {
                throw new Error(await readApiError(createRes));
            }

            const patchRes = await fetch(`/api/admin/appointment-requests/${request.id}`, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'accepted',
                    resolution_note: `Programada ${request.preferred_date} ${startTime}`,
                }),
            });
            if (!patchRes.ok) {
                console.warn('[solicitudes] cita creada pero no se pudo marcar accepted');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo programar la cita');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={() => !submitting && onCancel()}>
            <div
                ref={dialogRef}
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 480 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="modal__header">
                    <h3 id={titleId} className="modal__title flex items-center gap-2">
                        <Icon name="calendar" size={18} />
                        Programar cita
                    </h3>
                    <button className="modal__close" onClick={onCancel} aria-label="Cerrar" disabled={submitting}>
                        <Icon name="close" size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal__body">
                        <div className="space-y-3 text-sm">
                            <div>
                                <div className="text-gray-500 text-xs uppercase tracking-wide">Paciente</div>
                                <div className="font-medium">{request.patient_name ?? 'Paciente'}</div>
                            </div>
                            <div>
                                <div className="text-gray-500 text-xs uppercase tracking-wide">Servicio</div>
                                <div className="font-medium">
                                    {request.service_name ?? 'Servicio'} ({duration} min)
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-500 text-xs uppercase tracking-wide">Profesional</div>
                                <div className="font-medium">{request.professional_name ?? 'Profesional'}</div>
                            </div>
                            <div>
                                <div className="text-gray-500 text-xs uppercase tracking-wide">Fecha</div>
                                <div className="font-medium capitalize">{formatDateLong(request.preferred_date)}</div>
                            </div>
                            <div>
                                <label className="block text-gray-500 text-xs uppercase tracking-wide mb-1" htmlFor="start-time">
                                    Hora de inicio
                                </label>
                                <input
                                    id="start-time"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                    Fin estimado: {endTime}
                                </div>
                            </div>
                            {request.notes && (
                                <div>
                                    <div className="text-gray-500 text-xs uppercase tracking-wide">Notas paciente</div>
                                    <div className="italic text-gray-700">&ldquo;{request.notes}&rdquo;</div>
                                </div>
                            )}
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal__footer">
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn--info"
                            disabled={submitting}
                        >
                            <Icon name="check" size={14} />
                            {submitting ? 'Programando…' : 'Programar y aceptar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
