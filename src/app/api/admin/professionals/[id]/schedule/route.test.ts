import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';

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

const assertSameOriginMutationMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    assertSameOriginMutation: assertSameOriginMutationMock,
    requirePanelAccess: requirePanelAccessMock,
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin professional schedule route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('professional reads own schedule', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ id: 'slot-1', day_of_week: 1, start_time: '09:00', end_time: '12:00' }],
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/schedule'),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'slot-1', day_of_week: 1, start_time: '09:00', end_time: '12:00' }]);
        expect(query.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });

    it('owner reads any professional schedule', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue(null);
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ id: 'slot-1', day_of_week: 1, start_time: '09:00', end_time: '12:00' }],
                error: null,
            }),
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

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/schedule'),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'slot-1', day_of_week: 1, start_time: '09:00', end_time: '12:00' }]);
        expect(query.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });

    it('professional blocked from reading another professional schedule', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        requirePanelAccessMock.mockResolvedValue({
            supabase: { from: vi.fn() },
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/44444444-4444-4444-4444-444444444444/schedule'),
            { params: Promise.resolve({ id: '44444444-4444-4444-4444-444444444444' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
    });

    it('returns 403 for unauthorized access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden')
        );

        const response = await PUT(
            new Request('http://localhost/api/admin/professionals/pro-1/schedule', {
                method: 'PUT',
                body: JSON.stringify({
                    slots: [{ day_of_week: 1, start_time: '09:00', end_time: '12:00' }],
                }),
            }),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
    });
});
