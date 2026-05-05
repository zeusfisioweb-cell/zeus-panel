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

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());
const assertSameOriginMutationMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: assertSameOriginMutationMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

function createPostRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/push-subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
    });
}

describe('admin push subscriptions route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
        assertSameOriginMutationMock.mockReset();
    });

    it('returns degraded 202 on POST when push_subscriptions infra is missing', async () => {
        const upsert = vi.fn().mockResolvedValue({
            error: {
                code: '42P01',
                message: 'relation "push_subscriptions" does not exist',
            },
        });
        const supabase = {
            from: vi.fn().mockReturnValue({ upsert }),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await POST(createPostRequest({
            endpoint: 'https://example.test/sub',
            keys: { p256dh: 'abc', auth: 'def' },
        }));
        const body = await response.json();

        expect(response.status).toBe(202);
        expect(body).toEqual({ ok: false, degraded: true });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 200 enabled=false on GET when infra is missing', async () => {
        const is = vi.fn().mockResolvedValue({
            data: null,
            error: {
                code: 'PGRST205',
                message: 'Could not find the table in schema cache',
                details: 'push_subscriptions',
            },
        });
        const eq = vi.fn().mockReturnValue({ is });
        const select = vi.fn().mockReturnValue({ eq });
        const supabase = {
            from: vi.fn().mockReturnValue({ select }),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ enabled: false, degraded: true });
    });

    it('returns enabled=true when active subscriptions exist', async () => {
        const is = vi.fn().mockResolvedValue({
            data: [{ endpoint: 'https://example.test/sub', disabled_at: null }],
            error: null,
        });
        const eq = vi.fn().mockReturnValue({ is });
        const select = vi.fn().mockReturnValue({ eq });
        const supabase = {
            from: vi.fn().mockReturnValue({ select }),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ enabled: true });
    });
});
