import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

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

describe('portal dependientes DELETE', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        checkRateLimitMock.mockReset();
    });

    it('enforces same-origin and returns 429 when rate limited', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: false,
            limit: 12,
            remaining: 0,
            reset: Date.now() + 60_000,
        });

        const request = new Request('http://localhost/api/portal/dependientes/11111111-1111-1111-1111-111111111111', {
            method: 'DELETE',
            headers: { 'x-forwarded-for': '203.0.113.10' },
        });

        const response = await DELETE(request, {
            params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
        });
        const body = await response.json();

        expect(assertSameOriginMutationMock).toHaveBeenCalledWith(request);
        expect(response.status).toBe(429);
        expect(body).toEqual({ error: 'Too many requests' });
        expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    });
});
