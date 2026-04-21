import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const ApiRouteErrorMock = vi.hoisted(() => class ApiRouteError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
});

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin appointment delete route RBAC', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('filters delete by professional_id when requester is professional', async () => {
        const query = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'appointment-1' },
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
            professionalId: 'professional-row-1',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('professional-row-1');

        const response = await DELETE(
            new Request('http://localhost/api/admin/appointments/appointment-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'appointment-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(query.eq).toHaveBeenCalledWith('id', 'appointment-1');
        expect(query.eq).toHaveBeenCalledWith('professional_id', 'professional-row-1');
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'pro-user-1',
                action: 'DELETE',
                tableName: 'appointments',
                recordId: 'appointment-1',
            })
        );
    });

    it('returns 404 when appointment does not exist for the scoped professional', async () => {
        const query = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
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
            professionalId: 'professional-row-1',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('professional-row-1');

        const response = await DELETE(
            new Request('http://localhost/api/admin/appointments/appointment-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: 'appointment-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Appointment not found' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
