import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

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

vi.mock('../../_lib', () => ({
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

describe('admin schedule exception delete route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('deletes schedule exception and writes audit log', async () => {
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(deleteQuery),
        };
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'exception-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(deleteQuery.eq).toHaveBeenCalledWith('id', 'exception-1');
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'DELETE',
                tableName: 'schedule_exceptions',
                recordId: 'exception-1',
            })
        );
    });

    it('returns 403 for non-owner access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'exception-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when Supabase delete fails', async () => {
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: { message: 'delete failed' } }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(deleteQuery),
        };
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'exception-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
