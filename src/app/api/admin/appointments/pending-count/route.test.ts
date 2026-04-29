import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

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

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() =>
    vi.fn((role: string, professionalId: string | null) => (role === 'professional' ? professionalId : null))
);

vi.mock('../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin appointments pending-count route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockClear();
    });

    it('filters pending count by professional id when role is professional', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            count: 3,
            error: null,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ count: 3 });
        expect(query.eq).toHaveBeenCalledWith('status', 'pending');
        expect(query.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });

    it('returns 401 when access check fails', async () => {
        requirePanelAccessMock.mockRejectedValue(new ApiRouteErrorMock(401, 'Unauthorized'));

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 500 when supabase returns an error', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            count: null,
            error: { message: 'db failed' },
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(query.eq).not.toHaveBeenCalledWith('professional_id', expect.anything());
    });
});
