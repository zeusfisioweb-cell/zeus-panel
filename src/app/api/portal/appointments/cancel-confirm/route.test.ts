import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const assertSameOriginMutationMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const verifyCancelTokenMock = vi.hoisted(() => vi.fn());
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

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: checkRateLimitMock,
}));

vi.mock('@/lib/portal-token', () => ({
    verifyCancelToken: verifyCancelTokenMock,
}));

describe('portal cancel-confirm POST', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        checkRateLimitMock.mockReset();
        verifyCancelTokenMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('returns 429 when rate limit is exceeded', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: false,
            limit: 8,
            remaining: 0,
            reset: Date.now() + 60_000,
        });

        const request = new Request('http://localhost/api/portal/appointments/cancel-confirm', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
            body: JSON.stringify({ token: 'valid-token-value' }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(assertSameOriginMutationMock).toHaveBeenCalledWith(request);
        expect(response.status).toBe(429);
        expect(body).toEqual({ error: 'Too many requests' });
    });

    it('cancels appointment and writes audit log when token is valid', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: true,
            limit: 8,
            remaining: 7,
            reset: Date.now() + 60_000,
        });
        verifyCancelTokenMock.mockResolvedValue({
            aptId: '11111111-1111-1111-1111-111111111111',
            patientId: '22222222-2222-2222-2222-222222222222',
            actorUserId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        });

        const maybeSingle = vi.fn().mockResolvedValue({
            data: { id: '11111111-1111-1111-1111-111111111111' },
            error: null,
        });
        const auditInsert = vi.fn().mockResolvedValue({ error: null });

        const adminClient = {
            from: vi.fn((table: string) => {
                if (table === 'appointments') {
                    return {
                        update: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        in: vi.fn().mockReturnThis(),
                        select: vi.fn().mockReturnThis(),
                        maybeSingle,
                    };
                }
                if (table === 'audit_logs') {
                    return { insert: auditInsert };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const request = new Request('http://localhost/api/portal/appointments/cancel-confirm', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
            body: JSON.stringify({ token: 'valid-token-value-valid-token' }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true, status: 'success' });
        expect(auditInsert).toHaveBeenCalledTimes(1);
    });
});
