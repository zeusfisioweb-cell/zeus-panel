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
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../../_lib', () => ({
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

describe('admin professional schedule route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns schedule slots for owner', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ id: 'slot-1' }],
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/pro-1/schedule'),
            { params: Promise.resolve({ id: 'pro-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'slot-1' }]);
        expect(query.eq).toHaveBeenCalledWith('professional_id', 'pro-1');
    });

    it('replaces schedule and writes audit log', async () => {
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const insertQuery = {
            insert: vi.fn().mockResolvedValue({ error: null }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'schedule_slots') {
                    return {
                        ...deleteQuery,
                        insert: insertQuery.insert,
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await PUT(
            new Request('http://localhost/api/admin/professionals/pro-1/schedule', {
                method: 'PUT',
                body: JSON.stringify({
                    slots: [{ day_of_week: 1, start_time: '09:00', end_time: '14:00' }],
                }),
            }),
            { params: Promise.resolve({ id: 'pro-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(deleteQuery.eq).toHaveBeenCalledWith('professional_id', 'pro-1');
        expect(insertQuery.insert).toHaveBeenCalledWith([
            {
                professional_id: 'pro-1',
                day_of_week: 1,
                start_time: '09:00',
                end_time: '14:00',
            },
        ]);
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'UPDATE',
                tableName: 'schedule_slots',
                recordId: 'pro-1',
                details: { replaced_slots_count: 1 },
            })
        );
    });

    it('returns 403 for non-owner mutation access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await PUT(
            new Request('http://localhost/api/admin/professionals/pro-1/schedule', {
                method: 'PUT',
                body: JSON.stringify({ slots: [] }),
            }),
            { params: Promise.resolve({ id: 'pro-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when delete fails', async () => {
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: { message: 'delete failed' } }),
        };
        const supabase = {
            from: vi.fn(() => deleteQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await PUT(
            new Request('http://localhost/api/admin/professionals/pro-1/schedule', {
                method: 'PUT',
                body: JSON.stringify({ slots: [] }),
            }),
            { params: Promise.resolve({ id: 'pro-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
