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
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../_lib', () => ({
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

describe('admin schedule exception delete route', () => {
    beforeEach(() => {
        assertSameOriginMutationMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('owner deletes schedule exception and writes audit log', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue(null);
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '99999999-9999-9999-9999-999999999999' },
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(deleteQuery),
        };
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '99999999-9999-9999-9999-999999999999' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(assertSameOriginMutationMock).toHaveBeenCalled();
        expect(deleteQuery.eq).toHaveBeenCalledWith('id', '99999999-9999-9999-9999-999999999999');
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'DELETE',
                tableName: 'schedule_exceptions',
                recordId: '99999999-9999-9999-9999-999999999999',
            })
        );
    });

    it('professional deletes their own exception', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '99999999-9999-9999-9999-999999999999' },
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(deleteQuery),
        };
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/pro-exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '99999999-9999-9999-9999-999999999999' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(deleteQuery.eq).toHaveBeenCalledWith('id', '99999999-9999-9999-9999-999999999999');
        expect(deleteQuery.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'pro-user-1',
                action: 'DELETE',
                tableName: 'schedule_exceptions',
                recordId: '99999999-9999-9999-9999-999999999999',
            })
        );
    });

    it('returns 404 when professional tries to delete another professional exception (DB filter blocks)', async () => {
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            // DB scope filter means 0 rows affected → data: null
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(deleteQuery),
        };
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/other-exception', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '88888888-8888-8888-8888-888888888888' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Schedule exception not found or access denied' });
        expect(deleteQuery.eq).toHaveBeenCalledWith('id', '88888888-8888-8888-8888-888888888888');
        expect(deleteQuery.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 403 for non-owner non-professional access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '99999999-9999-9999-9999-999999999999' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when Supabase delete fails', async () => {
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'delete failed' } }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(deleteQuery),
        };
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await DELETE(
            new Request('http://localhost/api/admin/schedule-exceptions/exception-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '99999999-9999-9999-9999-999999999999' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
