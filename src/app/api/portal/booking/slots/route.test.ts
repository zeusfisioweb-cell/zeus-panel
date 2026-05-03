import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// ---- hoisted mocks --------------------------------------------------------

const createClientMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/app/api/admin/_lib', () => ({
    getAdminSupabase: getAdminSupabaseMock,
    handleApiError: (error: unknown) => {
        if (error instanceof Error) {
            return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

// ---- helpers ---------------------------------------------------------------

const PROFESSIONAL_ID = '33333333-3333-3333-3333-333333333333';
const DATE = '2026-05-10';
const DURATION = '60';

function makeUrl(params: Record<string, string> = {}) {
    const base = new URL('http://localhost/api/portal/booking/slots');
    for (const [key, val] of Object.entries(params)) {
        base.searchParams.set(key, val);
    }
    return base.toString();
}

function makeAuthClient(user: { id: string } | null = { id: 'user-1' }) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user } }),
        },
    };
}

function makeAdminClient(slots: unknown[] = [], error: unknown = null) {
    return {
        rpc: vi.fn().mockResolvedValue({ data: slots, error }),
    };
}

const SLOTS = [
    { start_time: '2026-05-10T09:00:00.000Z', end_time: '2026-05-10T10:00:00.000Z' },
    { start_time: '2026-05-10T10:00:00.000Z', end_time: '2026-05-10T11:00:00.000Z' },
];

// ---- tests -----------------------------------------------------------------

describe('GET /api/portal/booking/slots', () => {
    beforeEach(() => {
        createClientMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('returns 401 when user is not authenticated', async () => {
        createClientMock.mockResolvedValue(makeAuthClient(null));

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE, duration_minutes: DURATION })),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when professional_id is missing', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await GET(
            new Request(makeUrl({ date: DATE, duration_minutes: DURATION })),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('required');
    });

    it('returns 400 when date is missing', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, duration_minutes: DURATION })),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
    });

    it('returns 400 when duration_minutes is missing', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE })),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
    });

    it('returns 400 when duration_minutes is zero (falsy)', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE, duration_minutes: '0' })),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
    });

    it('returns 200 with slots on happy path', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient(SLOTS));

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE, duration_minutes: DURATION })),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveProperty('slots');
        expect(body.slots).toHaveLength(2);
        expect(body.slots[0].start_time).toBe('2026-05-10T09:00:00.000Z');
    });

    it('returns 200 with empty slots when none available', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([]));

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE, duration_minutes: DURATION })),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.slots).toEqual([]);
    });

    it('calls get_available_slots RPC with correct params', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient(SLOTS);
        getAdminSupabaseMock.mockReturnValue(adminClient);

        await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE, duration_minutes: DURATION })),
        );

        expect(adminClient.rpc).toHaveBeenCalledWith('get_available_slots', {
            p_professional_id: PROFESSIONAL_ID,
            p_date: DATE,
            p_duration_minutes: 60,
        });
    });

    it('returns 500 when Supabase RPC returns an error', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([], { message: 'RPC error' }));

        const response = await GET(
            new Request(makeUrl({ professional_id: PROFESSIONAL_ID, date: DATE, duration_minutes: DURATION })),
        );
        expect(response.status).toBe(500);
    });
});
