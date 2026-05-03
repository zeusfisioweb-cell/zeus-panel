import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// ---- hoisted mocks --------------------------------------------------------

const requirePanelAccessMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/admin/_lib', () => ({
    requirePanelAccess: requirePanelAccessMock,
    handleApiError: (error: unknown) => {
        if (error instanceof Error) {
            return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

// ---- helpers ---------------------------------------------------------------

function makePatientRow(created_at: string) {
    return { created_at };
}

/**
 * Build a minimal Supabase mock that returns the given patient rows for the
 * time-series query and 0 for the three count queries (baseline, total,
 * gdpr, marketing).
 */
function makeSupabase(rows: { created_at: string }[] = [], baselineCount = 0) {
    let callIndex = 0;

    const countChain = (count: number) => ({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ count, error: null }),
        gte: vi.fn().mockResolvedValue({ count, error: null }),
        eq: vi.fn().mockReturnThis(),
    });

    const rowChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };

    return {
        from: vi.fn(() => {
            callIndex++;
            if (callIndex === 1) return rowChain;       // time-series select
            if (callIndex === 2) return countChain(baselineCount); // baseline before fromDate
            if (callIndex === 3) return countChain(rows.length);   // totalActive
            if (callIndex === 4) return countChain(0);             // gdprConsent
            return countChain(0);                                   // marketingConsent
        }),
    };
}

// ---- tests -----------------------------------------------------------------

describe('GET /api/admin/patients/growth', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
    });

    it('returns 500 when requirePanelAccess throws', async () => {
        requirePanelAccessMock.mockRejectedValue(new Error('Unauthorized'));

        const response = await GET(new Request('http://localhost/api/admin/patients/growth'));
        expect(response.status).toBe(500);
    });

    it('returns 200 with points and kpis for default period (month)', async () => {
        const supabase = makeSupabase([], 0);
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(new Request('http://localhost/api/admin/patients/growth'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveProperty('period', 'month');
        expect(body).toHaveProperty('points');
        expect(Array.isArray(body.points)).toBe(true);
        expect(body.points).toHaveLength(12);
        expect(body).toHaveProperty('kpis');
        expect(body.kpis).toHaveProperty('total');
        expect(body.kpis).toHaveProperty('gdprConsentRate');
        expect(body.kpis).toHaveProperty('marketingConsentRate');
    });

    it('returns 200 with 12 points for period=week', async () => {
        const supabase = makeSupabase([], 0);
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(
            new Request('http://localhost/api/admin/patients/growth?period=week'),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.period).toBe('week');
        expect(body.points).toHaveLength(12);
    });

    it('returns 200 with 5 points for period=year', async () => {
        const supabase = makeSupabase([], 0);
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(
            new Request('http://localhost/api/admin/patients/growth?period=year'),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.period).toBe('year');
        expect(body.points).toHaveLength(5);
    });

    it('counts new patients in the correct bucket', async () => {
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15T10:00:00.000Z`;
        const supabase = makeSupabase([makePatientRow(thisMonth)], 5);
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(new Request('http://localhost/api/admin/patients/growth'));
        const body = await response.json();

        expect(response.status).toBe(200);
        const lastPoint = body.points[body.points.length - 1];
        expect(lastPoint.new_patients).toBe(1);
        // total = baseline (5) + cumulative new patients up to this bucket
        expect(lastPoint.total_patients).toBeGreaterThanOrEqual(6);
    });

    it('returns 200 with empty points when no patients exist', async () => {
        const supabase = makeSupabase([], 0);
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(new Request('http://localhost/api/admin/patients/growth'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.points.every((p: { new_patients: number }) => p.new_patients === 0)).toBe(true);
        expect(body.kpis.total).toBe(0);
        expect(body.kpis.gdprConsentRate).toBe(0);
        expect(body.kpis.marketingConsentRate).toBe(0);
    });

    it('returns 500 when Supabase throws on data fetch', async () => {
        const supabase = {
            from: vi.fn(() => ({
                select: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                gte: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            })),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(new Request('http://localhost/api/admin/patients/growth'));
        expect(response.status).toBe(500);
    });
});
