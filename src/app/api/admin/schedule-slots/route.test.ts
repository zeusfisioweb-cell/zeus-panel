import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

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
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    assertSameOriginMutation: assertSameOriginMutationMock,
    requirePanelAccess: requirePanelAccessMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin schedule slots route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('creates schedule slot and writes audit log', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '88888888-8888-8888-8888-888888888888', professional_id: '33333333-3333-3333-3333-333333333333' },
            error: null,
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await POST(
            new Request('http://localhost/api/admin/schedule-slots', {
                method: 'POST',
                body: JSON.stringify({
                    professional_id: '33333333-3333-3333-3333-333333333333',
                    day_of_week: 1,
                    start_time: '09:00',
                    end_time: '12:00',
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ id: '88888888-8888-8888-8888-888888888888', professional_id: '33333333-3333-3333-3333-333333333333' });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'CREATE',
                tableName: 'schedule_slots',
                recordId: '88888888-8888-8888-8888-888888888888',
            })
        );
    });

    it('returns 403 for non-owner access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await POST(
            new Request('http://localhost/api/admin/schedule-slots', {
                method: 'POST',
                body: JSON.stringify({
                    professional_id: '33333333-3333-3333-3333-333333333333',
                    day_of_week: 1,
                    start_time: '09:00',
                    end_time: '12:00',
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when Supabase insert fails', async () => {
        const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'insert failed' },
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await POST(
            new Request('http://localhost/api/admin/schedule-slots', {
                method: 'POST',
                body: JSON.stringify({
                    professional_id: '33333333-3333-3333-3333-333333333333',
                    day_of_week: 1,
                    start_time: '09:00',
                    end_time: '12:00',
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
