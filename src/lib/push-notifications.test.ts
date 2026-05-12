import { describe, expect, it } from 'vitest';
import { buildPanelAppointmentPushPayload } from './push-notifications';

describe('buildPanelAppointmentPushPayload', () => {
    it('builds created payload with native defaults', () => {
        const payload = buildPanelAppointmentPushPayload({
            kind: 'created',
            patientName: 'Ana García',
            serviceName: 'Fisioterapia General',
            startTime: '2026-05-12T15:00:00.000Z',
        });

        expect(payload.title).toBe('Nueva cita');
        expect(payload.body).toContain('Ana García');
        expect(payload.body).toContain('Fisioterapia General');
        expect(payload.url).toBe('/citas');
        expect(payload.tag).toContain('appointment-created');
        expect(payload.requireInteraction).toBe(false);
        expect(payload.renotify).toBe(true);
        expect(payload.silent).toBe(false);
        expect(payload.actions).toEqual([{ action: 'open_schedule', title: 'Ver agenda' }]);
        expect(payload.data.kind).toBe('created');
    });

    it('builds cancelled payload requiring interaction', () => {
        const payload = buildPanelAppointmentPushPayload({
            kind: 'cancelled',
            patientName: 'Luis Pérez',
            serviceName: 'Rehabilitación',
            startTime: '2026-05-12T10:00:00.000Z',
        });

        expect(payload.title).toBe('Cita cancelada');
        expect(payload.tag).toContain('appointment-cancelled');
        expect(payload.requireInteraction).toBe(true);
        expect(payload.data.kind).toBe('cancelled');
    });
});
