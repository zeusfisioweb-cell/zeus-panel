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

describe('admin service categories route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns categories for owner', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ id: 'cat-1', name: 'Fisio' }],
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'cat-1', name: 'Fisio' }]);
        expect(query.order).toHaveBeenCalledWith('display_order');
    });

    it('creates category, slugifies name and writes audit log', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'cat-1', name: 'Fisio Avanzada' },
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
            new Request('http://localhost/api/admin/service-categories', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Fisio Avanzada',
                    is_active: true,
                    display_order: 2,
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ id: 'cat-1', name: 'Fisio Avanzada' });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Fisio Avanzada',
                slug: 'fisio-avanzada',
            })
        );
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'CREATE',
                tableName: 'service_categories',
                recordId: 'cat-1',
            })
        );
    });

    it('returns 403 for non-owner mutation access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await POST(
            new Request('http://localhost/api/admin/service-categories', {
                method: 'POST',
                body: JSON.stringify({ name: 'X' }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
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
            new Request('http://localhost/api/admin/service-categories', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Fisio Avanzada',
                    is_active: true,
                    display_order: 2,
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
