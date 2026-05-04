import type { AppointmentSource, AppointmentStatus } from '@/lib/types';

const MADRID_TIME_ZONE = 'Europe/Madrid';

const APPOINTMENT_SOURCES: AppointmentSource[] = ['web', 'admin', 'phone'];
const APPOINTMENT_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed'];

type AppointmentRealtimeRecord = Record<string, unknown> | null | undefined;

export type AppointmentRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AppointmentRealtimePayload {
    eventType: AppointmentRealtimeEvent;
    new: AppointmentRealtimeRecord;
    old: AppointmentRealtimeRecord;
}

export interface AppointmentToastNotification {
    title: string;
    description: string;
}

function getStringValue(record: AppointmentRealtimeRecord, key: string): string | null {
    if (!record || typeof record !== 'object') return null;
    const value = record[key];
    if (typeof value !== 'string' || value.trim() === '') return null;
    return value;
}

function parseAppointmentSource(record: AppointmentRealtimeRecord): AppointmentSource | null {
    const source = getStringValue(record, 'source');
    if (!source) return null;
    return APPOINTMENT_SOURCES.includes(source as AppointmentSource) ? (source as AppointmentSource) : null;
}

function parseAppointmentStatus(record: AppointmentRealtimeRecord): AppointmentStatus | null {
    const status = getStringValue(record, 'status');
    if (!status) return null;
    return APPOINTMENT_STATUSES.includes(status as AppointmentStatus) ? (status as AppointmentStatus) : null;
}

function formatAppointmentDate(record: AppointmentRealtimeRecord): string {
    const startTime = getStringValue(record, 'start_time');
    if (!startTime) return 'Horario pendiente';

    const date = new Date(startTime);
    if (Number.isNaN(date.getTime())) return 'Horario pendiente';

    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: MADRID_TIME_ZONE,
    }).format(date);
}

function getPatientLabel(record: AppointmentRealtimeRecord): string {
    return getStringValue(record, 'patient_name') ?? 'Paciente sin nombre';
}

function getInsertTitle(record: AppointmentRealtimeRecord): string {
    const source = parseAppointmentSource(record);
    if (source === 'web') return 'Nueva reserva web';
    if (source === 'phone') return 'Nueva reserva telefónica';
    return 'Nueva cita registrada';
}

function buildDescription(record: AppointmentRealtimeRecord): string {
    return `${getPatientLabel(record)} · ${formatAppointmentDate(record)}`;
}

export function getAppointmentRealtimeNotification(
    payload: AppointmentRealtimePayload
): AppointmentToastNotification | null {
    if (payload.eventType === 'INSERT') {
        return {
            title: getInsertTitle(payload.new),
            description: buildDescription(payload.new),
        };
    }

    if (payload.eventType === 'UPDATE') {
        const nextStatus = parseAppointmentStatus(payload.new);
        if (nextStatus !== 'cancelled') return null;

        const previousStatus = parseAppointmentStatus(payload.old);
        if (previousStatus === 'cancelled') return null;

        return {
            title: 'Cita cancelada',
            description: buildDescription(payload.new),
        };
    }

    return null;
}
