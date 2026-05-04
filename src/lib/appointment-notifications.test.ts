import { describe, expect, it } from 'vitest';
import { getAppointmentRealtimeNotification } from './appointment-notifications';

describe('getAppointmentRealtimeNotification', () => {
    it('returns reservation notification for web insert', () => {
        const notification = getAppointmentRealtimeNotification({
            eventType: 'INSERT',
            new: {
                source: 'web',
                patient_name: 'Ana García',
                start_time: '2026-05-05T15:00:00.000Z',
            },
            old: {},
        });

        expect(notification).not.toBeNull();
        expect(notification?.title).toBe('Nueva reserva web');
        expect(notification?.description).toContain('Ana García');
    });

    it('returns cancellation notification when status changes to cancelled', () => {
        const notification = getAppointmentRealtimeNotification({
            eventType: 'UPDATE',
            new: {
                status: 'cancelled',
                patient_name: 'Luis Pérez',
                start_time: '2026-05-05T10:00:00.000Z',
            },
            old: {
                status: 'confirmed',
            },
        });

        expect(notification).not.toBeNull();
        expect(notification?.title).toBe('Cita cancelada');
        expect(notification?.description).toContain('Luis Pérez');
    });

    it('returns null when update keeps cancelled status', () => {
        const notification = getAppointmentRealtimeNotification({
            eventType: 'UPDATE',
            new: {
                status: 'cancelled',
            },
            old: {
                status: 'cancelled',
            },
        });

        expect(notification).toBeNull();
    });

    it('returns null when update status is not cancelled', () => {
        const notification = getAppointmentRealtimeNotification({
            eventType: 'UPDATE',
            new: {
                status: 'confirmed',
            },
            old: {
                status: 'pending',
            },
        });

        expect(notification).toBeNull();
    });
});
