import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

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
    normalizeNullableText: (value: string | null | undefined) => {
        if (value == null) return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    },
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin professional exceptions route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns exceptions list for owner', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ id: '99999999-9999-9999-9999-999999999999' }],
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions?from=2026-04-17'),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: '99999999-9999-9999-9999-999999999999' }]);
        expect(query.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
        expect(query.gte).toHaveBeenCalledWith('exception_date', '2026-04-17');
    });

    it('inserts date range exceptions and writes audit log', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null });
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await POST(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: '2026-04-17',
                    end_date: '2026-04-19',
                    reason: ' vacaciones ',
                    is_available: false,
                }),
            }),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, inserted: 3 });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                professional_id: '33333333-3333-3333-3333-333333333333',
                exception_date: '2026-04-17',
                reason: 'vacaciones',
            }),
            expect.objectContaining({ exception_date: '2026-04-18' }),
            expect.objectContaining({ exception_date: '2026-04-19' }),
        ]);
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'CREATE',
                tableName: 'schedule_exceptions',
                recordId: '33333333-3333-3333-3333-333333333333',
                details: { inserted_days: 3 },
            })
        );
    });

    it('returns 403 for non-owner mutation access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await POST(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: '2026-04-17',
                    is_available: false,
                }),
            }),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when Supabase insert fails', async () => {
        const insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await POST(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: '2026-04-17',
                    is_available: false,
                }),
            }),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
