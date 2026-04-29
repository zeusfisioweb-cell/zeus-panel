import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH, DELETE } from './route';

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

describe('admin professionals route GET RBAC', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('returns only the authenticated professional record for professional users', async () => {
        const professionalQuery = {
            data: [
                {
                    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                    user_id: 'user-1',
                    is_active: true,
                    profile: { role: 'professional', full_name: 'Pro Uno' },
                },
            ],
            error: null,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
        };

        const supabase = {
            from: vi.fn().mockReturnValue(professionalQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(professionalQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(professionalQuery.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('filters out non-professional rows for owner users', async () => {
        const ownerQuery = {
            data: [
                {
                    id: 'owner-as-prof',
                    user_id: 'owner-user',
                    profile: { role: 'owner', full_name: 'Owner' },
                },
                {
                    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                    user_id: 'user-1',
                    profile: { role: 'professional', full_name: 'Pro Uno' },
                },
            ],
            error: null,
            select: vi.fn().mockReturnThis(),
        };

        const supabase = {
            from: vi.fn().mockReturnValue(ownerQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-user',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    });

    it('updates full_name through professionals.user_id instead of professionals.id', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', user_id: 'user-1' },
                error: null,
            }),
        };
        const profileUpdate = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                if (table === 'profiles') return profileUpdate;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-user',
        });

        const response = await PATCH(new Request('http://localhost/api/admin/professionals', {
            method: 'PATCH',
            body: JSON.stringify({
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                full_name: 'Pro Actualizado',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(professionalLookup.eq).toHaveBeenCalledWith('id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(profileUpdate.eq).toHaveBeenCalledWith('id', 'user-1');
        expect(writeAuditLogMock).toHaveBeenCalled();
    });

    it('returns 404 when professional not found in PATCH', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        const supabase = { from: vi.fn().mockReturnValue(professionalLookup) };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await PATCH(new Request('http://localhost/api/admin/professionals', {
            method: 'PATCH',
            body: JSON.stringify({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', is_active: false }),
        }));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Professional not found' });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
    });

    it('replaces service links when serviceIds is provided', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', user_id: 'user-1' },
                error: null,
            }),
        };
        const rpc = vi.fn().mockResolvedValue({ error: null });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
            rpc,
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await PATCH(new Request('http://localhost/api/admin/professionals', {
            method: 'PATCH',
            body: JSON.stringify({
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                serviceIds: ['44444444-4444-4444-4444-444444444444'],
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(rpc).toHaveBeenCalledWith('replace_professional_service_links', {
            p_professional_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            p_service_ids: ['44444444-4444-4444-4444-444444444444'],
        });
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            details: expect.objectContaining({ service_links_updated: true }),
        }));
    });
});

describe('admin professionals route DELETE', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('disables professional and bans auth account', async () => {
        const updateUserById = vi.fn().mockResolvedValue({ error: null });
        getAdminSupabaseMock.mockReturnValue({ auth: { admin: { updateUserById } } });

        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', user_id: 'user-1' },
                error: null,
            }),
        };
        const appointmentCount = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
        };
        const deleteSlots = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const disableProfessional = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        let professionalsCallCount = 0;
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') {
                    professionalsCallCount++;
                    return professionalsCallCount === 1 ? professionalLookup : disableProfessional;
                }
                if (table === 'appointments') return appointmentCount;
                if (table === 'schedule_slots') return deleteSlots;
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await DELETE(new Request('http://localhost/api/admin/professionals', {
            method: 'DELETE',
            body: JSON.stringify({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(disableProfessional.update).toHaveBeenCalledWith({ is_active: false });
        expect(disableProfessional.eq).toHaveBeenCalledWith('id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(updateUserById).toHaveBeenCalledWith('user-1', { ban_duration: '87600h' });
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'DELETE',
            tableName: 'professionals',
            recordId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        }));
    });

    it('detaches future appointments before disabling a professional', async () => {
        const updateUserById = vi.fn().mockResolvedValue({ error: null });
        getAdminSupabaseMock.mockReturnValue({ auth: { admin: { updateUserById } } });

        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', user_id: 'user-1' },
                error: null,
            }),
        };
        const appointmentCount = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ count: 2, error: null }),
        };
        const detachAppointments = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ error: null }),
        };
        const deleteSlots = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        const disableProfessional = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        };
        let professionalsCallCount = 0;

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') {
                    professionalsCallCount++;
                    return professionalsCallCount === 1 ? professionalLookup : disableProfessional;
                }
                if (table === 'appointments') {
                    return appointmentCount.select.mock.calls.length === 0
                        ? appointmentCount
                        : detachAppointments;
                }
                if (table === 'schedule_slots') return deleteSlots;
                throw new Error(`Unexpected table ${table}`);
            }),
        };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await DELETE(new Request('http://localhost/api/admin/professionals', {
            method: 'DELETE',
            body: JSON.stringify({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, reassignedAppointments: 2 });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(detachAppointments.update).toHaveBeenCalledWith({ professional_id: null });
        expect(detachAppointments.eq).toHaveBeenCalledWith('professional_id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(disableProfessional.update).toHaveBeenCalledWith({ is_active: false });
        expect(disableProfessional.eq).toHaveBeenCalledWith('id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            details: expect.objectContaining({
                reassigned_appointments: 2,
                auth_banned: true,
                auth_ban_error: null,
            }),
        }));
    });

    it('returns 404 when professional not found in DELETE', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        const supabase = { from: vi.fn().mockReturnValue(professionalLookup) };
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await DELETE(new Request('http://localhost/api/admin/professionals', {
            method: 'DELETE',
            body: JSON.stringify({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
        }));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Professional not found' });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
