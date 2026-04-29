import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const assertSameOriginMutationMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/admin/_lib', () => ({
    assertSameOriginMutation: assertSameOriginMutationMock,
    getAdminSupabase: vi.fn(),
    handleApiError: (error: unknown) => {
        if (error instanceof Error) {
            return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: checkRateLimitMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

describe('portal dependientes POST', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        checkRateLimitMock.mockReset();
    });

    it('enforces same-origin and returns 429 when rate limited', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: false,
            limit: 8,
            remaining: 0,
            reset: Date.now() + 60_000,
        });

        const request = new Request('http://localhost/api/portal/dependientes', {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.10' },
            body: JSON.stringify({
                first_name: 'Test',
                last_name: 'Dep',
                birth_date: '2012-01-01',
                gdpr_consented_by_guardian: true,
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(assertSameOriginMutationMock).toHaveBeenCalledWith(request);
        expect(response.status).toBe(429);
        expect(body).toEqual({ error: 'Too many requests' });
        expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    });
});
