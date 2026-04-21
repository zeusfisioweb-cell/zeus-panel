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

const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    ensurePatientAccess: ensurePatientAccessMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            'message' in error
        ) {
            const apiError = error as { status: number; message: string };
            return Response.json({ error: apiError.message }, { status: apiError.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

function createJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/clinical-records', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('admin clinical records route RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('stores the scoped professional id when professional creates a record', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'record-1' },
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
            userId: 'pro-user-1',
            professionalId: 'professional-row-1',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('professional-row-1');
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: 'patient-1',
            type: 'evolution',
            content: { treatment_applied: 'Terapia manual aplicada' },
        }));

        expect(response.status).toBe(200);
        expect(ensurePatientAccessMock).toHaveBeenCalledWith({
            supabase,
            role: 'professional',
            professionalId: 'professional-row-1',
            patientId: 'patient-1',
        });
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                patient_id: 'patient-1',
                professional_id: 'professional-row-1',
            })
        );
        expect(writeAuditLogMock).toHaveBeenCalled();
    });

    it('requires owner requests to provide professional_id', async () => {
        requirePanelAccessMock.mockResolvedValue({
            supabase: {
                from: vi.fn(),
            },
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await POST(createJsonRequest({
            patient_id: 'patient-1',
            type: 'evolution',
            content: { treatment_applied: 'Terapia manual aplicada' },
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'professional_id is required for owner' });
    });
});
