import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GET, PATCH, POST } from './route';

const getProfessionalPatientIdsMock = vi.hoisted(() => vi.fn());
const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ensurePatientAccess: ensurePatientAccessMock,
    getProfessionalPatientIds: getProfessionalPatientIdsMock,
    handleApiError: (error: unknown) => {
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Invalid request data' }, { status: 400 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
    normalizeNullableText: (value: string | null | undefined) => value,
    requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    getAdminSupabase: getAdminSupabaseMock,
}));

describe('admin patients route RBAC', () => {
    beforeEach(() => {
        getProfessionalPatientIdsMock.mockReset();
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('filters patient list by professional accessible ids', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
                data: [{ id: '11111111-1111-1111-1111-111111111111' }],
                count: 1,
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
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');
        getProfessionalPatientIdsMock.mockResolvedValue(['11111111-1111-1111-1111-111111111111']);

        const response = await GET(new Request('http://localhost/api/admin/patients?page=1&pageSize=50'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(getProfessionalPatientIdsMock).toHaveBeenCalledWith(supabase, '33333333-3333-3333-3333-333333333333');
        expect(query.in).toHaveBeenCalledWith('id', ['11111111-1111-1111-1111-111111111111']);
        expect(body).toEqual({
            data: [{ id: '11111111-1111-1111-1111-111111111111' }],
            count: 1,
        });
    });

    it('rejects updates that remove both email and phone', async () => {
        requirePanelAccessMock.mockResolvedValue({
            supabase: {},
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await PATCH(new Request('http://localhost/api/admin/patients', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '11111111-1111-1111-1111-111111111111',
                email: null,
                phone: null,
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'Invalid request data' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns all patients for owner without professional filter', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
                data: [
                    { id: '11111111-1111-1111-1111-111111111111' },
                    { id: '22222222-2222-2222-2222-222222222222' },
                ],
                count: 2,
                error: null,
            }),
        };
        const supabase = { from: vi.fn().mockReturnValue(query) };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await GET(new Request('http://localhost/api/admin/patients'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(2);
        expect(body.count).toBe(2);
        expect(getProfessionalPatientIdsMock).not.toHaveBeenCalled();
    });

    it('sanitizes wildcard characters before applying patient search', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
                data: [],
                count: 0,
                error: null,
            }),
        };
        const supabase = { from: vi.fn().mockReturnValue(query) };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await GET(new Request('http://localhost/api/admin/patients?search=Ana,_%25(Test)&page=1&pageSize=20'));

        expect(response.status).toBe(200);
        expect(query.or).toHaveBeenCalledWith('first_name.ilike.%Ana Test%,last_name.ilike.%Ana Test%,document_id.ilike.%Ana Test%,phone.ilike.%Ana Test%');
    });

    it('creates a new patient and writes audit log', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '11111111-1111-1111-1111-111111111111', first_name: 'Ana' },
            error: null,
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = { from: vi.fn().mockReturnValue({ insert }) };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await POST(new Request('http://localhost/api/admin/patients', {
            method: 'POST',
            body: JSON.stringify({
                first_name: 'Ana',
                last_name: 'Lopez',
                email: 'ana@example.com',
                gdpr_consent: true,
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.first_name).toBe('Ana');
        expect(insert).toHaveBeenCalled();
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE',
            tableName: 'patients',
            recordId: '11111111-1111-1111-1111-111111111111',
        }));
    });

    it('creates explicit assignment when a professional creates a patient', async () => {
        const patientSingle = vi.fn().mockResolvedValue({
            data: { id: '11111111-1111-1111-1111-111111111111', first_name: 'Ana' },
            error: null,
        });
        const patientSelect = vi.fn().mockReturnValue({ single: patientSingle });
        const patientInsert = vi.fn().mockReturnValue({ select: patientSelect });
        const assignmentInsert = vi.fn().mockResolvedValue({ error: null });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'patients') return { insert: patientInsert };
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        const adminSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'patient_professionals') return { insert: assignmentInsert };
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        getAdminSupabaseMock.mockReturnValue(adminSupabase);

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await POST(new Request('http://localhost/api/admin/patients', {
            method: 'POST',
            body: JSON.stringify({
                first_name: 'Ana',
                last_name: 'Lopez',
                email: 'ana@example.com',
                gdpr_consent: true,
            }),
        }));

        expect(response.status).toBe(200);
        expect(assignmentInsert).toHaveBeenCalledWith({
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            assigned_by: 'pro-user-1',
            source: 'manual',
        });
    });

    it('updates patient and writes audit log', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: { email: 'old@example.com', phone: null },
            error: null,
        });
        const single = vi.fn().mockResolvedValue({
            data: { id: '11111111-1111-1111-1111-111111111111', email: 'new@example.com' },
            error: null,
        });
        let callCount = 0;
        const supabase = {
            from: vi.fn((table: string) => {
                if (table !== 'patients') throw new Error(`Unexpected table ${table}`);
                callCount++;
                if (callCount === 1) {
                    // First call: read current patient for contact validation
                    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
                }
                // Second call: update patient
                return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnValue({ single }) };
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await PATCH(new Request('http://localhost/api/admin/patients', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '11111111-1111-1111-1111-111111111111',
                email: 'new@example.com',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.email).toBe('new@example.com');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'patients',
        }));
    });

    it('rejects an update when the resulting patient would have neither email nor phone', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: { email: null, phone: '600000000' },
            error: null,
        });
        const update = vi.fn();
        const supabase = {
            from: vi.fn((table: string) => {
                if (table !== 'patients') throw new Error(`Unexpected table ${table}`);
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle,
                    update,
                };
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await PATCH(new Request('http://localhost/api/admin/patients', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '11111111-1111-1111-1111-111111111111',
                phone: null,
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'Debe proporcionar al menos un correo o número de teléfono' });
        expect(update).not.toHaveBeenCalled();
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('professional patches assigned patient successfully', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '11111111-1111-1111-1111-111111111111', first_name: 'Updated' },
            error: null,
        });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table !== 'patients') throw new Error(`Unexpected table ${table}`);
                return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnValue({ single }) };
            }),
        };

        ensurePatientAccessMock.mockResolvedValue(undefined);
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await PATCH(new Request('http://localhost/api/admin/patients', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '11111111-1111-1111-1111-111111111111',
                first_name: 'Updated',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.first_name).toBe('Updated');
        expect(ensurePatientAccessMock).toHaveBeenCalledWith(expect.objectContaining({
            patientId: '11111111-1111-1111-1111-111111111111',
        }));
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'patients',
        }));
    });
});
