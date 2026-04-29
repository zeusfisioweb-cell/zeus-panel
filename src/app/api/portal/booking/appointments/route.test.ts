import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const assertSameOriginMutationMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());
const isAlignedToIntervalMock = vi.hoisted(() => vi.fn());
const findConflictMock = vi.hoisted(() => vi.fn());

const ApiRouteErrorMock = vi.hoisted(
    () =>
        class ApiRouteError extends Error {
            status: number;
            constructor(status: number, message: string) {
                super(message);
                this.status = status;
            }
        }
);

vi.mock('@/app/api/admin/_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    assertSameOriginMutation: assertSameOriginMutationMock,
    getAdminSupabase: getAdminSupabaseMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: checkRateLimitMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/booking-validation', () => ({
    isAlignedToInterval: isAlignedToIntervalMock,
    findConflict: findConflictMock,
}));

describe('portal booking appointments POST', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        checkRateLimitMock.mockReset();
        createClientMock.mockReset();
        getAdminSupabaseMock.mockReset();
        isAlignedToIntervalMock.mockReset();
        findConflictMock.mockReset();
    });

    it('returns 429 when rate limit is exceeded', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: false,
            limit: 12,
            remaining: 0,
            reset: Date.now() + 60_000,
        });

        const request = new Request('http://localhost/api/portal/booking/appointments', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
            body: JSON.stringify({}),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(assertSameOriginMutationMock).toHaveBeenCalledWith(request);
        expect(response.status).toBe(429);
        expect(body).toEqual({ error: 'Too many requests' });
    });

    it('returns 422 when end_time does not match service duration', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: true,
            limit: 12,
            remaining: 11,
            reset: Date.now() + 60_000,
        });
        isAlignedToIntervalMock.mockReturnValue(true);
        findConflictMock.mockReturnValue(null);

        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
                    error: null,
                }),
            },
        });

        const patientsMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: '22222222-2222-2222-2222-222222222222',
                first_name: 'Ana',
                last_name: 'Test',
                phone: null,
                email: 'ana@test.com',
                document_id: null,
            },
            error: null,
        });
        const servicesMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: '33333333-3333-3333-3333-333333333333', name: 'Servicio', duration_minutes: 60 },
            error: null,
        });
        const professionalsMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: '44444444-4444-4444-4444-444444444444' },
            error: null,
        });
        const professionalServicesMaybeSingle = vi.fn().mockResolvedValue({
            data: { service_id: '33333333-3333-3333-3333-333333333333' },
            error: null,
        });
        const settingsMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                booking_advance_days: 60,
                min_booking_notice_hours: 1,
                slot_interval_minutes: 15,
                buffer_minutes: 0,
                gdpr_text: null,
                informed_consent_text: null,
            },
            error: null,
        });

        const adminClient = {
            from: vi.fn((table: string) => {
                if (table === 'patients') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        is: vi.fn().mockReturnThis(),
                        maybeSingle: patientsMaybeSingle,
                    };
                }
                if (table === 'services') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: servicesMaybeSingle,
                    };
                }
                if (table === 'professionals') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: professionalsMaybeSingle,
                    };
                }
                if (table === 'professional_services') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: professionalServicesMaybeSingle,
                    };
                }
                if (table === 'booking_settings') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        maybeSingle: settingsMaybeSingle,
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        // Invalid: 30 minutes, but service duration is 60 minutes.
        const endTime = new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();

        const request = new Request('http://localhost/api/portal/booking/appointments', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
            body: JSON.stringify({
                service_id: '33333333-3333-3333-3333-333333333333',
                professional_id: '44444444-4444-4444-4444-444444444444',
                start_time: startTime,
                end_time: endTime,
                gdpr_consent: true,
                informed_consent: true,
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(assertSameOriginMutationMock).toHaveBeenCalledWith(request);
        expect(response.status).toBe(422);
        expect(body).toEqual({ error: 'Duración de cita inválida para el servicio seleccionado' });
    });
});
