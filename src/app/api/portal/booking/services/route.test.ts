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

const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';

const SERVICE_ROWS = [
    { id: 'svc-1', name: 'Fisioterapia', description: 'Desc', duration_minutes: 60, price: 50 },
    { id: 'svc-2', name: 'Osteopatía', description: null, duration_minutes: 45, price: 40 },
];

function makeAuthClient(user: { id: string } | null = { id: 'user-1' }) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user } }),
        },
    };
}

function makeAdminClient(data = SERVICE_ROWS, error: unknown = null) {
    return {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data, error }),
        })),
    };
}

// ---- tests -----------------------------------------------------------------

describe('GET /api/portal/booking/services', () => {
    beforeEach(() => {
        createClientMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('returns 401 when user is not authenticated', async () => {
        createClientMock.mockResolvedValue(makeAuthClient(null));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/services?category_id=${CATEGORY_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when category_id is missing', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await GET(
            new Request('http://localhost/api/portal/booking/services'),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'category_id required' });
    });

    it('returns 200 with services on happy path', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient());

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/services?category_id=${CATEGORY_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveProperty('services');
        expect(body.services).toHaveLength(2);
        expect(body.services[0].id).toBe('svc-1');
    });

    it('returns 200 with empty array when no services match', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([]));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/services?category_id=${CATEGORY_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.services).toEqual([]);
    });

    it('returns 500 when Supabase returns an error', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([], { message: 'DB error' }));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/services?category_id=${CATEGORY_ID}`),
        );
        expect(response.status).toBe(500);
    });

    it('uses admin supabase client to bypass RLS', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient();
        getAdminSupabaseMock.mockReturnValue(adminClient);

        await GET(
            new Request(`http://localhost/api/portal/booking/services?category_id=${CATEGORY_ID}`),
        );

        expect(getAdminSupabaseMock).toHaveBeenCalledOnce();
        expect(adminClient.from).toHaveBeenCalledWith('services');
    });
});
