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

const createSupabaseAdminMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
    createClient: createSupabaseAdminMock,
}));

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    writeAuditLog: writeAuditLogMock,
    getAdminSupabase: () => createSupabaseAdminMock(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    ),
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

function createPostRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/create-professional', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('admin create professional route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
        createSupabaseAdminMock.mockReset();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    });

    it('returns 403 when requester is not owner', async () => {
        requirePanelAccessMock.mockRejectedValue(
            new ApiRouteErrorMock(403, 'Forbidden: owner role required')
        );

        const response = await POST(createPostRequest({}));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
        expect(createSupabaseAdminMock).not.toHaveBeenCalled();
    });

    it('returns 400 when payload validation fails', async () => {
        const adminClient = {
            auth: {
                admin: {
                    createUser: vi.fn(),
                    deleteUser: vi.fn(),
                },
            },
            from: vi.fn(),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase: {},
            userId: 'owner-1',
        });
        createSupabaseAdminMock.mockReturnValue(adminClient);

        const response = await POST(createPostRequest({
            email: 'invalid-email',
            full_name: '',
            service_ids: [],
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toHaveProperty('error');
        expect(adminClient.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it('creates professional and writes audit log on success', async () => {
        const createUser = vi.fn().mockResolvedValue({
            data: { user: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' } },
            error: null,
        });
        const deleteUser = vi.fn().mockResolvedValue({});
        const profileUpsert = vi.fn().mockResolvedValue({ error: null });
        const professionalUpsert = vi.fn().mockResolvedValue({ error: null });
        const serviceInsert = vi.fn().mockResolvedValue({ error: null });
        const scheduleInsert = vi.fn().mockResolvedValue({ error: null });
        const adminClient = {
            auth: {
                admin: {
                    createUser,
                    deleteUser,
                },
            },
            from: vi.fn((table: string) => {
                if (table === 'profiles') return { upsert: profileUpsert };
                if (table === 'professionals') return { upsert: professionalUpsert };
                if (table === 'professional_services') return { insert: serviceInsert };
                if (table === 'schedule_slots') return { insert: scheduleInsert };
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase: {},
            userId: 'owner-1',
        });
        createSupabaseAdminMock.mockReturnValue(adminClient);

        const response = await POST(createPostRequest({
            email: 'pro@example.com',
            full_name: 'Pro Uno',
            specialty: 'Fisioterapia',
            bio: null,
            color_code: '#AD7332',
            is_active: true,
            service_ids: ['44444444-4444-4444-4444-444444444444'],
            schedule_slots: [
                { day_of_week: 1, start_time: '09:00', end_time: '13:00' },
            ],
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' });
        expect(createSupabaseAdminMock).toHaveBeenCalledWith(
            'https://example.supabase.co',
            'service-role-key',
            expect.objectContaining({
                auth: expect.objectContaining({
                    autoRefreshToken: false,
                    persistSession: false,
                }),
            })
        );
        expect(createUser).toHaveBeenCalled();
        expect(profileUpsert).toHaveBeenCalled();
        expect(professionalUpsert).toHaveBeenCalled();
        expect(serviceInsert).toHaveBeenCalled();
        expect(scheduleInsert).toHaveBeenCalled();
        expect(deleteUser).not.toHaveBeenCalled();
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'CREATE',
                tableName: 'professionals',
                recordId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                details: expect.objectContaining({
                    email: 'pro@example.com',
                    service_count: 1,
                }),
            })
        );
    });
});
