'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Icon from '@/components/Icon';
import ConfirmModal from '@/components/ConfirmModal';
import {
    APPOINTMENT_REQUESTS_COUNT_KEY,
    APPOINTMENT_REQUESTS_QUERY_KEY,
    useAppointmentRequests,
    useResolveAppointmentRequest,
    type AppointmentRequest,
} from '@/hooks/useAppointmentRequests';
import { ScheduleRequestModal } from './ScheduleRequestModal';

type StatusFilter = 'pending' | 'all';

type PendingAction = { id: string; type: 'declined' } | null;

function formatDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00`);
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Madrid',
    }).format(date);
}

function formatCreatedAt(iso: string): string {
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Madrid',
    }).format(new Date(iso));
}

function statusLabel(status: AppointmentRequest['status']): string {
    switch (status) {
        case 'pending': return 'Pendiente';
        case 'accepted': return 'Aceptada';
        case 'declined': return 'Rechazada';
        case 'expired': return 'Expirada';
        case 'cancelled': return 'Cancelada (paciente)';
    }
}

export default function SolicitudesPage() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<StatusFilter>('pending');
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [scheduleTarget, setScheduleTarget] = useState<AppointmentRequest | null>(null);

    const { data: requests, isLoading, isError, error } = useAppointmentRequests(filter);
    const resolve = useResolveAppointmentRequest();

    const sorted = useMemo(() => requests ?? [], [requests]);

    const handleDecline = async () => {
        if (!pendingAction) return;
        try {
            await resolve.mutateAsync({
                id: pendingAction.id,
                status: pendingAction.type,
            });
            toast.success('Solicitud rechazada');
            setPendingAction(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo actualizar');
        }
    };

    const handleScheduleSuccess = () => {
        toast.success('Cita programada y solicitud aceptada');
        setScheduleTarget(null);
        queryClient.invalidateQueries({ queryKey: APPOINTMENT_REQUESTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: APPOINTMENT_REQUESTS_COUNT_KEY });
    };

    const target = pendingAction ? sorted.find((r) => r.id === pendingAction.id) : null;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Solicitudes de cita</h1>
                <p className="text-sm text-gray-600">
                    Peticiones de pacientes para días sin huecos disponibles. Reorganiza la agenda
                    manualmente y marca la solicitud como aceptada o rechazada.
                </p>
            </header>

            <div className="flex gap-2 mb-4" role="tablist">
                {(['pending', 'all'] as StatusFilter[]).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={filter === value}
                        onClick={() => setFilter(value)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition ${filter === value
                            ? 'bg-[var(--brand-main)] text-white border-[var(--brand-main)]'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        {value === 'pending' ? 'Pendientes' : 'Todas'}
                    </button>
                ))}
            </div>

            {isLoading && <div className="text-gray-500 text-sm">Cargando…</div>}

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
                    {error instanceof Error ? error.message : 'Error al cargar'}
                </div>
            )}

            {!isLoading && !isError && sorted.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <Icon name="calendar" size={32} />
                    <p className="mt-2">No hay solicitudes {filter === 'pending' ? 'pendientes' : 'registradas'}.</p>
                </div>
            )}

            <ul className="space-y-3">
                {sorted.map((req) => (
                    <li
                        key={req.id}
                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                    >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900">
                                        {req.patient_name ?? 'Paciente'}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${req.status === 'pending'
                                        ? 'bg-amber-100 text-amber-800'
                                        : req.status === 'accepted'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {statusLabel(req.status)}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-700">
                                    <strong>{req.service_name ?? 'Servicio'}</strong>
                                    {req.professional_name ? ` · ${req.professional_name}` : ''}
                                </div>
                                <div className="text-sm text-gray-900 capitalize mt-1">
                                    {formatDate(req.preferred_date)}
                                </div>
                                {req.notes && (
                                    <div className="text-sm text-gray-600 mt-2 italic">
                                        &ldquo;{req.notes}&rdquo;
                                    </div>
                                )}
                                {req.patient_phone && (
                                    <a
                                        href={`tel:${req.patient_phone}`}
                                        className="inline-flex items-center gap-1 text-sm text-[var(--brand-main)] hover:underline mt-2"
                                    >
                                        <Icon name="phone" size={14} />
                                        {req.patient_phone}
                                    </a>
                                )}
                                <div className="text-xs text-gray-400 mt-2">
                                    Solicitada el {formatCreatedAt(req.created_at)}
                                </div>
                            </div>

                            {req.status === 'pending' && (
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setScheduleTarget(req)}
                                        disabled={resolve.isPending}
                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Programar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingAction({ id: req.id, type: 'declined' })}
                                        disabled={resolve.isPending}
                                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Rechazar
                                    </button>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {pendingAction && target && (
                <ConfirmModal
                    title="Rechazar solicitud"
                    message={`Marca esta solicitud como rechazada (paciente: ${target.patient_name ?? ''}, ${formatDate(target.preferred_date)}).`}
                    confirmLabel="Rechazar"
                    variant="warning"
                    onConfirm={handleDecline}
                    onCancel={() => setPendingAction(null)}
                />
            )}

            {scheduleTarget && (
                <ScheduleRequestModal
                    request={scheduleTarget}
                    onSuccess={handleScheduleSuccess}
                    onCancel={() => setScheduleTarget(null)}
                />
            )}
        </div>
    );
}
