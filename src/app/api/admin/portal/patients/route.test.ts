import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET } from './route';

// ---- hoisted mocks --------------------------------------------------------

const ApiRouteErrorMock = vi.hoisted(
    () =>
        class ApiRouteError extends Error {
            status: number;

            constructor(status: number, message: string) {
                super(message);
                this.status = status;
            }
        },
);

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/admin/_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    assertSameOriginMutation: vi.fn(),
    requirePanelAccess: requirePanelAccessMock,
    getAdminSupabase: getAdminSupabaseMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

// ---- helpers ---------------------------------------------------------------

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const PATIENT_ROWS = [
    { id: PATIENT_ID, first_name: 'Ana', last_name: 'García', email: 'ana@example.com', phone: '600000000', auth_user_id: null, created_at: '2026-01-01T00:00:00.000Z' },
];

function makeGetSupabase(data = PATIENT_ROWS, error: unknown = null) {
    // Route chains: .select().is().order('last_name').order('first_name')
    // The second .order() is the terminal call that resolves the promise.
    const innerOrderChain = {
        order: vi.fn().mockResolvedValue({ data, error }),
    };
    return {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue(innerOrderChain),
        })),
    };
}

function makeDeleteRequest(patientId = PATIENT_ID): Request {
    return new Request(
        `http://localhost/api/admin/portal/patients?patient_id=${patientId}`,
        { method: 'DELETE', headers: { origin: 'http://localhost' } },
    );
}

function makeDeleteSupabase(
    patient: { auth_user_id: string | null } | null = { auth_user_id: 'auth-123' },
    fetchError: unknown = null,
    updateError: unknown = null,
) {
    let callIndex = 0;
    return {
        from: vi.fn(() => {
            callIndex++;
            if (callIndex === 1) {
                // fetch patient
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: patient, error: fetchError }),
                };
            }
            // update patient
            return {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: updateError }),
            };
        }),
    };
}

// ---- tests: GET ------------------------------------------------------------

describe('GET /api/admin/portal/patients', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
    });

    it('returns 200 with patient list on happy path', async () => {
        const supabase = makeGetSupabase();
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe(PATIENT_ID);
    });

    it('returns 200 with empty array when no patients', async () => {
        const supabase = makeGetSupabase([]);
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([]);
    });

    it('returns 500 when requirePanelAccess throws', async () => {
        requirePanelAccessMock.mockRejectedValue(new Error('Unauthorized'));

        const response = await GET();
        expect(response.status).toBe(500);
    });

    it('returns 500 when Supabase returns an error', async () => {
        const supabase = makeGetSupabase([], { message: 'DB error' });
        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET();
        expect(response.status).toBe(500);
    });
});

// ---- tests: DELETE ---------------------------------------------------------

describe('DELETE /api/admin/portal/patients', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        getAdminSupabaseMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns 400 when patient_id is missing', async () => {
        const supabase = makeDeleteSupabase();
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });

        const request = new Request('http://localhost/api/admin/portal/patients', {
            method: 'DELETE',
            headers: { origin: 'http://localhost' },
        });
        const response = await DELETE(request);
        expect(response.status).toBe(400);
    });

    it('returns 400 when patient_id is not a valid UUID', async () => {
        const supabase = makeDeleteSupabase();
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        const request = new Request(
            'http://localhost/api/admin/portal/patients?patient_id=not-a-uuid',
            { method: 'DELETE', headers: { origin: 'http://localhost' } },
        );
        const response = await DELETE(request);
        expect(response.status).toBe(400);
    });

    it('returns 404 when patient does not exist', async () => {
        const supabase = makeDeleteSupabase(null, { message: 'not found' });
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        const adminSupabase = { auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } } };
        getAdminSupabaseMock.mockReturnValue(adminSupabase);

        const response = await DELETE(makeDeleteRequest());
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Paciente no encontrado' });
    });

    it('returns 200 and revokes portal access on happy path with auth_user_id', async () => {
        const supabase = makeDeleteSupabase({ auth_user_id: 'auth-user-123' });
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
        getAdminSupabaseMock.mockReturnValue({
            auth: { admin: { deleteUser: deleteUserMock } },
        });
        writeAuditLogMock.mockResolvedValue(undefined);

        const response = await DELETE(makeDeleteRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true });
        expect(deleteUserMock).toHaveBeenCalledWith('auth-user-123');
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'DELETE',
                tableName: 'portal_access',
                recordId: PATIENT_ID,
            }),
        );
    });

    it('returns 200 when patient has no auth_user_id (no auth deletion needed)', async () => {
        const supabase = makeDeleteSupabase({ auth_user_id: null });
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        const deleteUserMock = vi.fn();
        getAdminSupabaseMock.mockReturnValue({
            auth: { admin: { deleteUser: deleteUserMock } },
        });
        writeAuditLogMock.mockResolvedValue(undefined);

        const response = await DELETE(makeDeleteRequest());
        expect(response.status).toBe(200);
        expect(deleteUserMock).not.toHaveBeenCalled();
    });

    it('returns 500 when deleting auth user fails', async () => {
        const supabase = makeDeleteSupabase({ auth_user_id: 'auth-user-123' });
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        getAdminSupabaseMock.mockReturnValue({
            auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: { message: 'auth error' } }) } },
        });

        const response = await DELETE(makeDeleteRequest());
        expect(response.status).toBe(500);
    });
});
