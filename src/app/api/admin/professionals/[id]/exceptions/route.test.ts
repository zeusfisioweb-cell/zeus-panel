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
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    assertSameOriginMutation: assertSameOriginMutationMock,
    requirePanelAccess: requirePanelAccessMock,
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    normalizeNullableText: (v: string | null | undefined) => v?.trim() || null,
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
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('professional reads own exceptions', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ id: 'exc-1', exception_date: '2026-05-10', reason: 'vacaciones' }],
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
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions'),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'exc-1', exception_date: '2026-05-10', reason: 'vacaciones' }]);
        expect(query.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });

    it('owner reads exceptions for any professional', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue(null);
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ id: 'exc-1', exception_date: '2026-05-10' }],
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
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions'),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );

        expect(response.status).toBe(200);
    });

    it('professional blocked from reading another professional exceptions', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        requirePanelAccessMock.mockResolvedValue({
            supabase: { from: vi.fn() },
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/44444444-4444-4444-4444-444444444444/exceptions'),
            { params: Promise.resolve({ id: '44444444-4444-4444-4444-444444444444' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
    });

    it('professional creates exceptions for own id via POST', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        const fromMock = {
            insert: vi.fn().mockReturnValue({ error: null }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(fromMock),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await POST(
            new Request('http://localhost/api/admin/professionals/33333333-3333-3333-3333-333333333333/exceptions', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: '2026-05-10',
                    is_available: false,
                    reason: 'vacaciones',
                }),
            }),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, inserted: 1 });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(requirePanelAccessMock).not.toHaveBeenCalledWith(expect.objectContaining({ ownerOnly: true }));
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'pro-user-1',
                action: 'CREATE',
                tableName: 'schedule_exceptions',
            })
        );
    });

    it('returns 403 for unauthorized access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden')
        );

        const response = await GET(
            new Request('http://localhost/api/admin/professionals/pro-1/exceptions'),
            { params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
    });
});
