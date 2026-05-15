import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const ApiRouteErrorMock = vi.hoisted(() =>
    class ApiRouteError extends Error {
        status: number;
        constructor(status: number, message: string) {
            super(message);
            this.status = status;
        }
    }
);

const requirePanelAccessMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    requirePanelAccess: requirePanelAccessMock,
    selectAllRows: async (
        buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
    ) => {
        const { data, error } = await buildQuery(0, 999);
        if (error) throw error;
        return (data ?? []) as unknown[];
    },
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

function makeSupabaseMock(appointments: unknown[] = [], profCount = 2) {
    return {
        from: vi.fn((table: string) => {
            if (table === 'professionals') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: Array.from({ length: profCount }, (_, i) => ({ id: `prof-${i}`, profile: { full_name: `Prof ${i}` } })),
                            count: profCount,
                            error: null,
                        }),
                    }),
                };
            }
            if (table === 'appointments') {
                return {
                    select: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        range: vi.fn().mockResolvedValue({ data: appointments, error: null }),
                    }),
                };
            }
            // schedule_slots and any other table
            return {
                select: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            };
        }),
    };
}

const BASE_APT = {
    patient_id: 'pat-1',
    professional_id: 'prof-0',
    service_id: 'svc-1',
    status: 'completed',
    source: 'admin',
    start_time: '2026-03-15T10:00:00.000Z',
    end_time: '2026-03-15T11:00:00.000Z',
    service: { name: 'Fisioterapia', price: 30, duration_minutes: 60 },
};

describe('analytics route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
    });

    it('returns 403 for non-owner access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'owner role required')
        );
        const req = new Request('http://localhost/api/admin/analytics?period=last_30_days');
        const res = await GET(req);
        expect(res.status).toBe(403);
    });

    it('returns 500 when Supabase query fails', async () => {
        const supabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    gte: vi.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
                }),
            }),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, role: 'owner' });
        const req = new Request('http://localhost/api/admin/analytics?period=last_30_days');
        const res = await GET(req);
        expect(res.status).toBe(500);
    });

    it('returns all expected shape keys', async () => {
        const supabase = makeSupabaseMock([BASE_APT]);
        requirePanelAccessMock.mockResolvedValue({ supabase, role: 'owner' });

        const req = new Request('http://localhost/api/admin/analytics?period=all_time');
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty('adherence');
        expect(body).toHaveProperty('revenue');
        expect(body).toHaveProperty('professionals');
        expect(body).toHaveProperty('dayBreakdown');
        expect(body).toHaveProperty('statusBreakdown');
        expect(body).toHaveProperty('occupancy');
        expect(body).toHaveProperty('revenueTrend');
        expect(body).toHaveProperty('peakHours');
        expect(body).toHaveProperty('bookingSources');
        expect(body.bookingSources).toHaveProperty('phone');
        expect(body.bookingSources).toHaveProperty('web');
        expect(body.bookingSources).toHaveProperty('admin');
        expect(body.bookingSources).toHaveProperty('total');
    });

    it('counts bookingSources.phone correctly', async () => {
        const apts = [
            { ...BASE_APT, source: 'phone' },
            { ...BASE_APT, source: 'phone' },
            { ...BASE_APT, source: 'web' },
            { ...BASE_APT, source: 'admin' },
        ];
        const supabase = makeSupabaseMock(apts);
        requirePanelAccessMock.mockResolvedValue({ supabase, role: 'owner' });

        const req = new Request('http://localhost/api/admin/analytics?period=all_time');
        const res = await GET(req);
        const body = await res.json();
        expect(body.bookingSources.phone).toBe(2);
        expect(body.bookingSources.web).toBe(1);
        expect(body.bookingSources.admin).toBe(1);
    });

    it('adherence counts oneTime / twoThree / loyal correctly', async () => {
        const apts = [
            { ...BASE_APT, patient_id: 'pat-1' },                          // 1 visit → oneTime
            { ...BASE_APT, patient_id: 'pat-2' },
            { ...BASE_APT, patient_id: 'pat-2' },                          // 2 visits → twoThree
            { ...BASE_APT, patient_id: 'pat-3' },
            { ...BASE_APT, patient_id: 'pat-3' },
            { ...BASE_APT, patient_id: 'pat-3' },
            { ...BASE_APT, patient_id: 'pat-3' },                          // 4 visits → loyal
        ];
        const supabase = makeSupabaseMock(apts);
        requirePanelAccessMock.mockResolvedValue({ supabase, role: 'owner' });

        const req = new Request('http://localhost/api/admin/analytics?period=all_time');
        const res = await GET(req);
        const body = await res.json();
        expect(body.adherence.oneTime).toBe(1);
        expect(body.adherence.twoThree).toBe(1);
        expect(body.adherence.loyal).toBe(1);
        expect(body.adherence.totalPatients).toBe(3);
    });

    it('cancellationRate is 0 when no appointments', async () => {
        const supabase = makeSupabaseMock([]);
        requirePanelAccessMock.mockResolvedValue({ supabase, role: 'owner' });

        const req = new Request('http://localhost/api/admin/analytics?period=all_time');
        const res = await GET(req);
        const body = await res.json();
        expect(body.statusBreakdown.cancellationRate).toBe(0);
        expect(body.statusBreakdown.totalAll).toBe(0);
    });
});
