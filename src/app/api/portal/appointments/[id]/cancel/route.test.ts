import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const assertSameOriginMutationMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const signCancelTokenMock = vi.hoisted(() => vi.fn());
const sendCancellationRequestEmailMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/portal-token', () => ({
    signCancelToken: signCancelTokenMock,
}));

vi.mock('@/lib/email', () => ({
    sendCancellationRequestEmail: sendCancellationRequestEmailMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: checkRateLimitMock,
}));

describe('portal appointments cancel request route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        createClientMock.mockReset();
        signCancelTokenMock.mockReset();
        sendCancellationRequestEmailMock.mockReset();
        checkRateLimitMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('supports cancellation request for the authenticated patient', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: true,
            limit: 6,
            remaining: 5,
            reset: Date.now() + 60_000,
        });
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'auth-user-1' } },
                    error: null,
                }),
            },
        });
        signCancelTokenMock.mockResolvedValue('signed-token');
        sendCancellationRequestEmailMock.mockResolvedValue(undefined);

        const adminClient = {
            from: vi.fn((table: string) => {
                if (table === 'patients') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        is: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                                id: 'patient-self-1',
                                first_name: 'Ana',
                                last_name: 'López',
                                email: 'ana@example.com',
                            },
                            error: null,
                        }),
                    };
                }
                if (table === 'appointments') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                                id: 'apt-1',
                                status: 'confirmed',
                                start_time: '2027-04-01T10:00:00.000Z',
                                patient_id: 'patient-self-1',
                                patient: {
                                    id: 'patient-self-1',
                                    first_name: 'Ana',
                                    last_name: 'López',
                                    email: 'ana@example.com',
                                    birth_date: '1990-01-01',
                                    guardian_auth_user_id: null,
                                },
                                professionals: { profile: { full_name: 'Dr. Rivera' } },
                                services: { name: 'Fisioterapia' },
                            },
                            error: null,
                        }),
                    };
                }
                if (table === 'booking_settings') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: { cancellation_hours: 24 },
                            error: null,
                        }),
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const request = new Request('http://localhost/api/portal/appointments/apt-1/cancel', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
        });

        const response = await POST(request, { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(signCancelTokenMock).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'patient-self-1', 'auth-user-1');
        expect(sendCancellationRequestEmailMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'ana@example.com',
        }));
    });

    it('supports cancellation request for a dependent and emails the guardian', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: true,
            limit: 6,
            remaining: 5,
            reset: Date.now() + 60_000,
        });
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'guardian-auth-1' } },
                    error: null,
                }),
            },
        });
        signCancelTokenMock.mockResolvedValue('signed-token');
        sendCancellationRequestEmailMock.mockResolvedValue(undefined);

        const adminClient = {
            from: vi.fn((table: string) => {
                if (table === 'patients') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        is: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                                id: 'guardian-patient-1',
                                first_name: 'Marta',
                                last_name: 'García',
                                email: 'marta@example.com',
                            },
                            error: null,
                        }),
                    };
                }
                if (table === 'appointments') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                                id: 'apt-2',
                                status: 'pending',
                                start_time: '2027-05-01T09:00:00.000Z',
                                patient_id: 'dependent-patient-1',
                                patient: {
                                    id: 'dependent-patient-1',
                                    first_name: 'Leo',
                                    last_name: 'García',
                                    email: null,
                                    birth_date: '2016-02-10',
                                    guardian_auth_user_id: 'guardian-auth-1',
                                },
                                professionals: { profile: { full_name: 'Dra. Soler' } },
                                services: { name: 'Revisión' },
                            },
                            error: null,
                        }),
                    };
                }
                if (table === 'booking_settings') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: { cancellation_hours: 24 },
                            error: null,
                        }),
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const request = new Request('http://localhost/api/portal/appointments/apt-2/cancel', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
        });

        const response = await POST(request, { params: Promise.resolve({ id: '22222222-2222-2222-2222-222222222222' }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(signCancelTokenMock).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222', 'dependent-patient-1', 'guardian-auth-1');
        expect(sendCancellationRequestEmailMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'marta@example.com',
        }));
    });
});
