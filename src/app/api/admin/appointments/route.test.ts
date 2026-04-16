import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH, POST } from './route';

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

vi.mock('../_lib', () => ({
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

function createJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('admin appointments route RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('requires existing patient access when a professional creates a linked appointment', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'appointment-1', status: 'pending', professional: null },
            error: null,
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'professional-1',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: 'patient-1',
            service_id: 'service-1',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            source: 'admin',
            status: 'pending',
        }));

        expect(response.status).toBe(200);
        expect(ensurePatientAccessMock).toHaveBeenCalledWith({
            supabase,
            role: 'professional',
            userId: 'professional-1',
            patientId: 'patient-1',
        });
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                patient_id: 'patient-1',
                professional_id: 'professional-1',
            }),
        ]);
    });

    it('blocks a professional from moving an appointment to another patient', async () => {
        const update = vi.fn().mockReturnThis();
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'appointment-1',
                patient_id: 'patient-1',
                professional_id: 'professional-1',
            },
            error: null,
        });
        const appointmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle,
            update,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(appointmentQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'professional-1',
        });

        const response = await PATCH(createJsonRequest({
            id: 'appointment-1',
            patient_id: 'patient-2',
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
        expect(update).not.toHaveBeenCalled();
    });
});
