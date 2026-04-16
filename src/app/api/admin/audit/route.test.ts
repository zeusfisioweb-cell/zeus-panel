import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

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

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    requirePanelAccess: requirePanelAccessMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

function createJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/audit', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('admin audit route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('writes an audit event with owner-only access', async () => {
        const supabase = { from: vi.fn() };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });
        writeAuditLogMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            action: 'VIEW',
            table_name: 'patients',
            record_id: 'patient-1',
            details: { source: 'test' },
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(writeAuditLogMock).toHaveBeenCalledWith({
            supabase,
            userId: 'owner-1',
            action: 'VIEW',
            tableName: 'patients',
            recordId: 'patient-1',
            details: { source: 'test' },
        });
    });

    it('returns 401 when there is no authenticated session', async () => {
        requirePanelAccessMock.mockRejectedValue(new ApiRouteErrorMock(401, 'Unauthorized'));

        const response = await POST(createJsonRequest({
            action: 'VIEW',
            table_name: 'patients',
            record_id: 'patient-1',
        }));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});

