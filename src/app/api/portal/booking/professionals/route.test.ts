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

const SERVICE_ID = '44444444-4444-4444-4444-444444444444';

function makeAuthClient(user: { id: string } | null = { id: 'user-1' }) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user } }),
        },
    };
}

function makeAdminClient(
    rows: unknown[] = [],
    error: unknown = null,
) {
    return {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: rows, error }),
        })),
    };
}

// A fully shaped professional row as returned by the Supabase join
function makeProfessionalRow(overrides: Partial<{
    id: string;
    specialty: string;
    bio: string;
    color_code: string;
    is_active: boolean;
    profile: { full_name: string };
}> = {}) {
    return {
        professional: {
            id: 'prof-1',
            specialty: 'Fisio',
            bio: 'Bio text',
            color_code: '#FF0000',
            is_active: true,
            profile: { full_name: 'Dr. Test' },
            ...overrides,
        },
    };
}

// ---- tests -----------------------------------------------------------------

describe('GET /api/portal/booking/professionals', () => {
    beforeEach(() => {
        createClientMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('returns 401 when user is not authenticated', async () => {
        createClientMock.mockResolvedValue(makeAuthClient(null));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when service_id is missing', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await GET(
            new Request('http://localhost/api/portal/booking/professionals'),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'service_id required' });
    });

    it('returns 200 with active professionals on happy path', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        const row = makeProfessionalRow();
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([row]));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveProperty('professionals');
        expect(body.professionals).toHaveLength(1);
        expect(body.professionals[0].id).toBe('prof-1');
        expect(body.professionals[0].is_active).toBe(true);
    });

    it('filters out inactive professionals', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        const inactiveRow = makeProfessionalRow({ is_active: false });
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([inactiveRow]));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.professionals).toHaveLength(0);
    });

    it('returns 200 with empty array when no professionals exist', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([]));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.professionals).toEqual([]);
    });

    it('returns 500 when Supabase returns an error', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([], { message: 'DB error' }));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        expect(response.status).toBe(500);
    });

    it('handles array-shaped profile (Supabase join returns array)', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        const rowWithArrayProfile = {
            professional: {
                id: 'prof-2',
                specialty: 'Osteo',
                bio: null,
                color_code: '#00FF00',
                is_active: true,
                profile: [{ full_name: 'Dr. Array' }],
            },
        };
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([rowWithArrayProfile]));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.professionals[0].profile.full_name).toBe('Dr. Array');
    });

    it('handles array-shaped professional (Supabase join returns array)', async () => {
        createClientMock.mockResolvedValue(makeAuthClient());
        const rowWithArrayProfessional = {
            professional: [
                {
                    id: 'prof-3',
                    specialty: 'Pilates',
                    bio: 'text',
                    color_code: '#0000FF',
                    is_active: true,
                    profile: { full_name: 'Dr. Array Prof' },
                },
            ],
        };
        getAdminSupabaseMock.mockReturnValue(makeAdminClient([rowWithArrayProfessional]));

        const response = await GET(
            new Request(`http://localhost/api/portal/booking/professionals?service_id=${SERVICE_ID}`),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.professionals[0].id).toBe('prof-3');
    });
});
