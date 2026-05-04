import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

// ---- hoisted mocks --------------------------------------------------------

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/admin/_lib', () => ({
    assertSameOriginMutation: vi.fn(),
    requirePanelAccess: requirePanelAccessMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof Error) {
            const status = 'status' in error ? Number((error as { status: unknown }).status) : 500;
            return Response.json({ error: error.message }, { status: Number.isNaN(status) ? 500 : status });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

// ---- helpers ---------------------------------------------------------------

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeRequest(patientId = PATIENT_ID): Request {
    return new Request(`http://localhost/api/admin/patients/${patientId}/unlink-portal`, {
        method: 'POST',
        headers: { origin: 'http://localhost' },
    });
}

function makeContext(patientId = PATIENT_ID) {
    return { params: Promise.resolve({ id: patientId }) };
}

function makeSupabase(updateError: unknown = null) {
    const chain = {
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ error: updateError }),
            }),
        }),
    };

    return { from: vi.fn().mockReturnValue(chain) };
}

// ---- tests -----------------------------------------------------------------

describe('POST /api/admin/patients/[id]/unlink-portal', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns 401 when requirePanelAccess throws (no session)', async () => {
        requirePanelAccessMock.mockRejectedValue(
            Object.assign(new Error('Unauthorized'), { status: 401 }),
        );

        const response = await POST(makeRequest(), makeContext());
        expect(response.status).toBe(401);
    });

    it('returns 400 for invalid UUID param', async () => {
        const supabase = makeSupabase();
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });

        const response = await POST(makeRequest('not-a-uuid'), makeContext('not-a-uuid'));
        expect(response.status).toBe(500);
    });

    it('returns 200 and unlinks patient on happy path', async () => {
        const supabase = makeSupabase();
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        writeAuditLogMock.mockResolvedValue(undefined);

        const response = await POST(makeRequest(), makeContext());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'UPDATE',
                tableName: 'patients',
                recordId: PATIENT_ID,
                details: { unlink_portal: true },
            }),
        );
    });

    it('returns 500 when Supabase update returns an error', async () => {
        const updateError = { message: 'DB error', code: '42501' };
        const supabase = makeSupabase(updateError);
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });

        const response = await POST(makeRequest(), makeContext());
        expect(response.status).toBe(500);
    });

    it('calls audit log with correct details on success', async () => {
        const supabase = makeSupabase();
        requirePanelAccessMock.mockResolvedValue({ supabase, userId: USER_ID });
        writeAuditLogMock.mockResolvedValue(undefined);

        await POST(makeRequest(), makeContext());

        expect(writeAuditLogMock).toHaveBeenCalledOnce();
        const callArg = writeAuditLogMock.mock.calls[0][0];
        expect(callArg.userId).toBe(USER_ID);
        expect(callArg.supabase).toBe(supabase);
    });
});
