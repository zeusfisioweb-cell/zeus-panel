import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const ApiRouteErrorMock = vi.hoisted(() => class ApiRouteError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
});

const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    ensurePatientAccess: ensurePatientAccessMock,
    requirePanelAccess: requirePanelAccessMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin clinical record delete RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('blocks a professional from deleting another professional clinical record', async () => {
        const deleteRecord = vi.fn().mockReturnThis();
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'record-1',
                patient_id: 'patient-1',
                professional_id: 'professional-2',
            },
            error: null,
        });
        const recordQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle,
            delete: deleteRecord,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(recordQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'professional-1',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await DELETE(
            new Request('http://localhost/api/admin/clinical-records/record-1'),
            { params: Promise.resolve({ id: 'record-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
        expect(deleteRecord).not.toHaveBeenCalled();
    });
});
