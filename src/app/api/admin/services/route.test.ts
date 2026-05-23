import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, PATCH, DELETE } from './route';

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

const getAdminSupabaseMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    handleApiError: () => Response.json({ error: 'Internal Server Error' }, { status: 500 }),
    normalizeNullableText: (value: string | null | undefined) => value,
    writeAuditLog: writeAuditLogMock,
    getAdminSupabase: getAdminSupabaseMock,
}));

describe('admin services route GET RBAC', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns only active assigned services for professional users', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', is_active: true },
                error: null,
            }),
        };

        const servicesLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [
                    { service: { id: 'svc-1', name: 'Fisio', is_active: true } },
                    { service: { id: 'svc-2', name: 'Inactivo', is_active: false } },
                ],
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                if (table === 'professional_services') return servicesLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'svc-1', name: 'Fisio', is_active: true }]);
    });

    it('ignores missing linked services and sorts active professional services by name', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', is_active: true },
                error: null,
            }),
        };

        const servicesLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [
                    { service: { id: 'svc-2', name: 'Psicologia', is_active: true } },
                    { service: null },
                    { service: { id: 'svc-3', name: 'Masaje', is_active: false } },
                    { service: { id: 'svc-1', name: 'Fisioterapia', is_active: true } },
                ],
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                if (table === 'professional_services') return servicesLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([
            { id: 'svc-1', name: 'Fisioterapia', is_active: true },
            { id: 'svc-2', name: 'Psicologia', is_active: true },
        ]);
    });

    it('returns empty list when professional is inactive', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', is_active: false },
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
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([]);
    });

    it('returns full owner service list for owner users', async () => {
        const ownerLookup = {
            data: [{ id: 'svc-1', name: 'Fisio', is_active: true }],
            error: null,
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'services') return ownerLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'svc-1', name: 'Fisio', is_active: true }]);
    });
});

describe('admin services route POST', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('creates a service and writes audit log', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '44444444-4444-4444-4444-444444444444', name: 'Fisioterapia', is_active: true },
            error: null,
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = { from: vi.fn().mockReturnValue({ insert }) };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await POST(new Request('http://localhost/api/admin/services', {
            method: 'POST',
            body: JSON.stringify({
                category_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                name: 'Fisioterapia',
                duration_minutes: 60,
                price: 50,
                is_active: true,
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.name).toBe('Fisioterapia');
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(insert).toHaveBeenCalled();
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE',
            tableName: 'services',
            recordId: '44444444-4444-4444-4444-444444444444',
        }));
    });
});

describe('admin services route PATCH', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('updates a service and writes audit log', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '44444444-4444-4444-4444-444444444444', name: 'Fisio Actualizado', is_active: true },
            error: null,
        });
        const updateQuery = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({ single }),
        };
        const supabase = { from: vi.fn().mockReturnValue(updateQuery) };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await PATCH(new Request('http://localhost/api/admin/services', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '44444444-4444-4444-4444-444444444444',
                name: 'Fisio Actualizado',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.name).toBe('Fisio Actualizado');
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(updateQuery.update).toHaveBeenCalled();
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'services',
        }));
    });
});

describe('admin services route DELETE', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('deletes a service with no future appointments and writes audit log', async () => {
        const futureApptCount = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
        };
        const deleteRelations = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const deleteService = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'appointments') return futureApptCount;
                if (table === 'professional_services') return deleteRelations;
                if (table === 'services') return deleteService;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await DELETE(new Request('http://localhost/api/admin/services', {
            method: 'DELETE',
            body: JSON.stringify({ id: '44444444-4444-4444-4444-444444444444' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, detached: 0 });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(deleteRelations.eq).toHaveBeenCalledWith('service_id', '44444444-4444-4444-4444-444444444444');
        expect(deleteService.eq).toHaveBeenCalledWith('id', '44444444-4444-4444-4444-444444444444');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'DELETE',
            tableName: 'services',
            recordId: '44444444-4444-4444-4444-444444444444',
        }));
    });

    it('returns 409 with requiresConfirmation when service has future appointments and force is false', async () => {
        const futureApptCount = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ count: 3, error: null }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'appointments') return futureApptCount;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await DELETE(new Request('http://localhost/api/admin/services', {
            method: 'DELETE',
            body: JSON.stringify({ id: '44444444-4444-4444-4444-444444444444' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.count).toBe(3);
        expect(body.requiresConfirmation).toBe(true);
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('detaches future appointments and deletes service when force is true', async () => {
        const futureApptCount = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ count: 2, error: null }),
        };
        const deleteRelations = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const deleteService = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const detachAppts = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'appointments') return futureApptCount;
                if (table === 'professional_services') return deleteRelations;
                if (table === 'services') return deleteService;
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        const adminClient = {
            from: vi.fn((table: string) => {
                if (table === 'appointments') return detachAppts;
                throw new Error(`Unexpected admin table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await DELETE(new Request('http://localhost/api/admin/services', {
            method: 'DELETE',
            body: JSON.stringify({ id: '44444444-4444-4444-4444-444444444444', force: true }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.detached).toBe(2);
        expect(detachAppts.update).toHaveBeenCalledWith({ service_id: null });
        expect(detachAppts.eq).toHaveBeenCalledWith('service_id', '44444444-4444-4444-4444-444444444444');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'DELETE',
            tableName: 'services',
            details: { detached_appointments: 2 },
        }));
    });
});
