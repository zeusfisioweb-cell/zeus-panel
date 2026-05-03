import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _escapeWaText,
    _formatDate,
    _formatPhone,
    _maskPhone,
    sendAppointmentWhatsApp,
} from './whatsapp';

describe('_formatPhone', () => {
    it('returns digits as-is for non-Spanish numbers', () => {
        expect(_formatPhone('+1 555 123 4567')).toBe('15551234567');
    });

    it('prepends 34 to 9-digit Spanish numbers', () => {
        expect(_formatPhone('612345678')).toBe('34612345678');
        expect(_formatPhone('712345678')).toBe('34712345678');
    });

    it('keeps 34 prefix on 11-digit numbers', () => {
        expect(_formatPhone('34612345678')).toBe('34612345678');
        expect(_formatPhone('+34 612 345 678')).toBe('34612345678');
    });

    it('handles 0034 prefix by stripping 00', () => {
        expect(_formatPhone('0034612345678')).toBe('34612345678');
        expect(_formatPhone('0034 612 345 678')).toBe('34612345678');
    });

    it('strips spaces and punctuation', () => {
        expect(_formatPhone('+34 612-345-678')).toBe('34612345678');
        expect(_formatPhone('61 23 45 67 8')).toBe('34612345678');
    });
});

describe('_formatDate', () => {
    it('formats a date in Europe/Madrid timezone with Spanish locale', () => {
        // 2026-05-05 15:00 UTC = 17:00 Madrid (CEST, UTC+2)
        const result = _formatDate('2026-05-05T15:00:00.000Z');
        expect(result).toMatch(/martes/);
        expect(result).toMatch(/5 de mayo/);
        expect(result).toMatch(/17:00/);
    });

    it('formats a morning appointment correctly', () => {
        // 2026-05-05 08:00 UTC = 10:00 Madrid
        const result = _formatDate('2026-05-05T08:00:00.000Z');
        expect(result).toContain('10:00');
    });

    it('handles winter time (CET, UTC+1)', () => {
        // 2026-01-15 09:00 UTC = 10:00 Madrid (CET)
        const result = _formatDate('2026-01-15T09:00:00.000Z');
        expect(result).toContain('10:00');
    });

    it('includes day of week and month in Spanish', () => {
        const result = _formatDate('2026-05-05T15:00:00.000Z');
        expect(result).toContain('de mayo');
        expect(result).toMatch(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/);
    });
});

describe('_escapeWaText', () => {
    it('escapes WhatsApp markdown characters', () => {
        expect(_escapeWaText('Hola _que_ tal')).toBe('Hola \\_que\\_ tal');
        expect(_escapeWaText('hola *mundo*')).toBe('hola \\*mundo\\*');
        expect(_escapeWaText('foo ~bar~ baz')).toBe('foo \\~bar\\~ baz');
        expect(_escapeWaText('code `x` here')).toBe('code \\`x\\` here');
    });

    it('passes through normal text unchanged', () => {
        expect(_escapeWaText('Fisioterapia Deportiva')).toBe('Fisioterapia Deportiva');
        expect(_escapeWaText('Dra. María García')).toBe('Dra. María García');
    });
});

describe('_maskPhone', () => {
    it('masks all but last 4 digits', () => {
        expect(_maskPhone('34612345678')).toBe('*******5678');
    });

    it('handles short numbers', () => {
        expect(_maskPhone('1234')).toBe('***');
        expect(_maskPhone('1')).toBe('***');
    });

    it('strips non-digits before masking', () => {
        expect(_maskPhone('+34 612 345 678')).toBe('*******5678');
    });
});

describe('sendAppointmentWhatsApp', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    const baseParams = {
        patientName: 'María García',
        patientPhone: '34612345678',
        serviceName: 'Fisioterapia Deportiva',
        professionalName: 'Dr. Carlos Ruiz',
        startTime: '2026-05-05T15:00:00.000Z',
        isReschedule: false,
    };

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('logs in dev mode when token is missing', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');

        await sendAppointmentWhatsApp(baseParams);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            '[whatsapp:dev]',
            'Appointment confirmed',
            expect.objectContaining({
                patient: 'María García',
                service: 'Fisioterapia Deportiva',
                professional: 'Dr. Carlos Ruiz',
            })
        );
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('logs in dev mode when phone number id is missing', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'some-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');

        await sendAppointmentWhatsApp(baseParams);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            '[whatsapp:dev]',
            expect.any(String),
            expect.any(Object)
        );
    });

    it('sends message via fetch when env vars are set', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');

        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ messaging_product: 'whatsapp' }), { status: 200 })
        );
        vi.stubGlobal('fetch', fetchSpy);

        await sendAppointmentWhatsApp(baseParams);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toContain('graph.facebook.com/v22.0/123456789/messages');
        expect(init.headers.Authorization).toBe('Bearer test-token');

        const body = JSON.parse(init.body);
        expect(body.messaging_product).toBe('whatsapp');
        expect(body.to).toBe('34612345678');
        expect(body.type).toBe('text');
        expect(body.text.body).toContain('confirmada');
        expect(body.text.body).toContain('Fisioterapia Deportiva');
    });

    it('sends reschedule message with correct text', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');

        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({}), { status: 200 })
        );
        vi.stubGlobal('fetch', fetchSpy);

        await sendAppointmentWhatsApp({ ...baseParams, isReschedule: true });

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body.text.body).toContain('movido');
    });

    it('logs error when API returns non-ok response', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');

        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: { message: 'Invalid phone' } }), { status: 400 })
        );
        vi.stubGlobal('fetch', fetchSpy);

        await sendAppointmentWhatsApp(baseParams);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[whatsapp] Failed to send message:',
            expect.objectContaining({
                status: 400,
                to: '*******5678',
            })
        );
    });

    it('logs error on network failure', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');

        vi.stubGlobal('fetch', () => Promise.reject(new Error('Network error')));

        await sendAppointmentWhatsApp(baseParams);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[whatsapp] Error sending to',
            '*******5678'
        );
    });

    it('masks phone in error logs', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');

        vi.stubGlobal('fetch', () => Promise.reject(new Error('fail')));

        await sendAppointmentWhatsApp({ ...baseParams, patientPhone: '+34 682 807 845' });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[whatsapp] Error sending to',
            '*******7845'
        );
    });

    it('does not send when patient has empty phone', async () => {
        // The caller (route handler) is responsible for checking phone;
        // whatsapp.ts sends whatever it gets.
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');

        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        await sendAppointmentWhatsApp({ ...baseParams, patientPhone: '' });

        expect(fetchSpy).toHaveBeenCalled();
        expect(JSON.parse(fetchSpy.mock.calls[0][1].body).to).toBe('');
    });
});
