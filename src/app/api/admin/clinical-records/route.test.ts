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

    it('stores the scoped professional id when professional creates a record without prior patient relationship', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
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
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            type: 'evolution',
            content: { treatment_applied: 'Terapia manual aplicada' },
        }));

        expect(response.status).toBe(200);
        expect(ensurePatientAccessMock).not.toHaveBeenCalled();
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                patient_id: '11111111-1111-1111-1111-111111111111',
                professional_id: '33333333-3333-3333-3333-333333333333',
                content: { treatment_applied: 'Terapia manual aplicada' },
            })
        );
        expect(writeAuditLogMock).toHaveBeenCalled();
    });

    it('rejects invalid content for the selected clinical record type', async () => {
        const insert = vi.fn();
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            type: 'evolution',
            content: { patient_response: 'Mejoria subjetiva' },
        }));
        const body = await response.json();

        expect(response.status).toBe(422);
        expect(body.error).toBe('Invalid content for record type');
        expect(body.details).toHaveProperty('treatment_applied');
        expect(ensurePatientAccessMock).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('allows owner to create a record only for an active professional', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '33333333-3333-3333-3333-333333333333', is_active: true },
                error: null,
            }),
        };
        const single = vi.fn().mockResolvedValue({
            data: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
            error: null,
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                if (table === 'clinical_records') return { insert };
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            type: 'report',
            content: { diagnosis: 'Lumbalgia mecanica' },
        }));

        expect(response.status).toBe(200);
        expect(professionalLookup.eq).toHaveBeenCalledWith('id', '33333333-3333-3333-3333-333333333333');
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            professional_id: '33333333-3333-3333-3333-333333333333',
            content: { diagnosis: 'Lumbalgia mecanica' },
        }));
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE',
            tableName: 'clinical_records',
            details: { type: 'report' },
        }));
    });

    it('rejects owner clinical records for inactive professionals', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '33333333-3333-3333-3333-333333333333', is_active: false },
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            type: 'report',
            content: { diagnosis: 'Lumbalgia mecanica' },
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'Invalid professional_id' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('persists canonical clinical content without unexpected extra fields', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
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
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            type: 'evolution',
            content: {
                treatment_applied: 'Ejercicio terapeutico',
                unexpected_private_note: 'no persistir',
            },
        }));

        expect(response.status).toBe(200);
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                content: { treatment_applied: 'Ejercicio terapeutico' },
            })
        );
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
            patient_id: '11111111-1111-1111-1111-111111111111',
            type: 'evolution',
            content: { treatment_applied: 'Terapia manual aplicada' },
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'professional_id is required for owner' });
    });
});
