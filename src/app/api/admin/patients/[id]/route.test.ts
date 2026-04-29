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

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin patient delete route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('soft deletes patient and writes audit log for owner', async () => {
        const rpc = vi.fn().mockResolvedValue({ error: null });
        const supabase = { rpc };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/patients/patient-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(rpc).toHaveBeenCalledWith('soft_delete_patient', { patient_id_input: '11111111-1111-1111-1111-111111111111' });
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'DELETE',
                tableName: 'patients',
                recordId: '11111111-1111-1111-1111-111111111111',
            })
        );
    });

    it('returns 403 for non-owner access', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await DELETE(
            new Request('http://localhost/api/admin/patients/patient-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when rpc fails', async () => {
        const rpc = vi.fn().mockResolvedValue({ error: { message: 'rpc failed' } });
        const supabase = { rpc };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/patients/patient-1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
