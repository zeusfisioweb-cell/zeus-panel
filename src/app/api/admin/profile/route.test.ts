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

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin profile route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
    });

    it('returns current profile for authenticated users', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'user-1', role: 'owner' },
            error: null,
        });
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ id: 'user-1', role: 'owner' });
        expect(query.eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('returns 401 when no session is present', async () => {
        requirePanelAccessMock.mockRejectedValue(new ApiRouteErrorMock(401, 'Unauthorized'));

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 500 when supabase query fails', async () => {
        const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'profile read failed' },
        });
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
    });
});

