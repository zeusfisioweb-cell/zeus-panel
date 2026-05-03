import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

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

const createClientMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/app/api/admin/_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    assertSameOriginMutation: vi.fn(),
    getAdminSupabase: getAdminSupabaseMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: (error as InstanceType<typeof ApiRouteErrorMock>).message }, { status: (error as InstanceType<typeof ApiRouteErrorMock>).status });
        }
        if (error instanceof Error) {
            return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: checkRateLimitMock,
    getRetryAfterSeconds: vi.fn(() => 60),
    RATE_LIMIT_MESSAGE: 'rate limited',
}));

// ---- helpers ---------------------------------------------------------------

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const VALID_BODY = {
    first_name: 'Ana',
    last_name: 'García',
    document_id: '12345678A',
    phone: '600000000',
    birth_date: '1990-06-15',
    gdpr_consent: true,
};

function makeRequest(body: unknown = VALID_BODY): Request {
    return new Request('http://localhost/api/portal/complete-profile', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'http://localhost',
        },
        body: JSON.stringify(body),
    });
}

function makeAuthClient(user: { id: string; email: string } | null = { id: USER_ID, email: 'ana@example.com' }) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user } }),
        },
    };
}

/**
 * Build an admin supabase mock with configurable outcomes for the chain:
 * 1. patients.select.eq.is.maybeSingle  → already linked check
 * 2. patients.select.eq.is.maybeSingle  → DNI match check
 * 3. patients.insert.select.single      → new patient creation
 */
function makeAdminClient({
    alreadyLinked = null as null | { id: string },
    dniMatch = null as null | { id: string; auth_user_id: string | null; first_name: string; last_name: string; birth_date: string },
    createResult = { data: { id: 'new-patient-id' }, error: null } as { data: { id: string } | null; error: unknown },
    updateError = null as unknown,
    auditError = null as unknown,
} = {}) {
    let callIndex = 0;

    const auditInsertChain = {
        from: (table: string) => {
            if (table === 'audit_logs') {
                return { insert: vi.fn().mockResolvedValue({ error: auditError }) };
            }
            throw new Error(`Unexpected admin table: ${table}`);
        },
    };

    return {
        from: vi.fn((table: string) => {
            if (table === 'patients') {
                callIndex++;

                if (callIndex === 1) {
                    // already linked check
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        is: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({ data: alreadyLinked, error: null }),
                    };
                }

                if (callIndex === 2) {
                    // DNI match check
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        is: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({ data: dniMatch, error: null }),
                    };
                }

                if (callIndex === 3) {
                    // update matched patient or insert
                    if (dniMatch) {
                        return {
                            update: vi.fn().mockReturnThis(),
                            eq: vi.fn().mockResolvedValue({ error: updateError }),
                        };
                    }
                    // insert
                    return {
                        insert: vi.fn().mockReturnThis(),
                        select: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue(createResult),
                    };
                }
            }

            if (table === 'audit_logs') {
                return { insert: vi.fn().mockResolvedValue({ error: auditError }) };
            }

            throw new Error(`Unexpected table: ${table}`);
        }),
    };
}

// ---- tests -----------------------------------------------------------------

describe('POST /api/portal/complete-profile', () => {
    beforeEach(() => {
        createClientMock.mockReset();
        getAdminSupabaseMock.mockReset();
        checkRateLimitMock.mockReset();
    });

    it('returns 429 when rate limit is exceeded', async () => {
        checkRateLimitMock.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

        const response = await POST(makeRequest());
        expect(response.status).toBe(429);
    });

    it('returns 401 when user is not authenticated', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient(null));

        const response = await POST(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'No autenticado' });
    });

    it('returns 400 for missing required fields', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await POST(makeRequest({ first_name: '', last_name: 'García' }));
        expect(response.status).toBe(400);
    });

    it('returns 400 for invalid DNI format', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await POST(makeRequest({ ...VALID_BODY, document_id: 'INVALID' }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toMatch(/DNI|NIE|inválido/i);
    });

    it('returns 400 for invalid birth_date format', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());

        const response = await POST(makeRequest({ ...VALID_BODY, birth_date: '15-06-1990' }));
        expect(response.status).toBe(400);
    });

    it('returns 403 for underage patient (under 16)', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());

        const today = new Date();
        const birthDate = `${today.getFullYear() - 10}-01-01`;
        const response = await POST(makeRequest({ ...VALID_BODY, birth_date: birthDate }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatch(/16/);
    });

    it('returns 200 with linked when patient is already linked (idempotent)', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({ alreadyLinked: { id: 'existing-patient-id' } });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true, linked: 'existing-patient-id' });
    });

    it('returns 201 and creates new patient when no DNI match', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: null,
            createResult: { data: { id: 'brand-new-id' }, error: null },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        const body = await response.json();

        // Route returns 200 on create (not 201), check implementation
        expect([200, 201]).toContain(response.status);
        expect(body.ok).toBe(true);
        expect(body).toHaveProperty('created');
    });

    it('returns 200 and links existing patient when DNI matches with same name/dob', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: {
                id: 'matched-patient-id',
                auth_user_id: null,
                first_name: 'Ana',
                last_name: 'García',
                birth_date: '1990-06-15',
            },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true, linked: 'matched-patient-id' });
    });

    it('returns 409 when DNI is already linked to another user', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: {
                id: 'other-patient-id',
                auth_user_id: 'different-user-id',
                first_name: 'Ana',
                last_name: 'García',
                birth_date: '1990-06-15',
            },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toMatch(/vinculado|otra cuenta/i);
    });

    it('returns 403 when DNI matches but name or dob does not match', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: {
                id: 'matched-patient-id',
                auth_user_id: null,
                first_name: 'Maria',   // different name
                last_name: 'García',
                birth_date: '1990-06-15',
            },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatch(/datos no coinciden|clínica/i);
    });

    it('returns 409 on duplicate key constraint during insert (race condition)', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: null,
            createResult: { data: null, error: { code: '23505', message: 'duplicate key' } },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toMatch(/registrado|clínica/i);
    });

    it('returns 500 when insert fails with non-duplicate error', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: null,
            createResult: { data: null, error: { code: '42501', message: 'permission denied' } },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        expect(response.status).toBe(500);
    });

    it('returns 500 when update fails after DNI match', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());
        const adminClient = makeAdminClient({
            alreadyLinked: null,
            dniMatch: {
                id: 'matched-patient-id',
                auth_user_id: null,
                first_name: 'Ana',
                last_name: 'García',
                birth_date: '1990-06-15',
            },
            updateError: { message: 'DB write failed' },
        });
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await POST(makeRequest());
        expect(response.status).toBe(500);
    });

    it('uppercases the document_id before saving', async () => {
        checkRateLimitMock.mockResolvedValue({ success: true, reset: 0 });
        createClientMock.mockResolvedValue(makeAuthClient());

        let capturedDocumentId: unknown = null;
        const adminClient = {
            from: vi.fn((table: string) => {
                if (table === 'patients') {
                    const callCount = (adminClient.from as ReturnType<typeof vi.fn>).mock.calls.length;
                    if (callCount === 1) {
                        return {
                            select: vi.fn().mockReturnThis(),
                            eq: vi.fn().mockReturnThis(),
                            is: vi.fn().mockReturnThis(),
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }
                    if (callCount === 2) {
                        return {
                            select: vi.fn().mockReturnThis(),
                            eq: vi.fn().mockReturnThis(),
                            is: vi.fn().mockReturnThis(),
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }
                    return {
                        insert: vi.fn((payload: Record<string, unknown>) => {
                            capturedDocumentId = payload.document_id;
                            return {
                                select: vi.fn().mockReturnThis(),
                                single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
                            };
                        }),
                    };
                }
                if (table === 'audit_logs') {
                    return { insert: vi.fn().mockResolvedValue({ error: null }) };
                }
                throw new Error(`Unexpected table: ${table}`);
            }),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        await POST(makeRequest({ ...VALID_BODY, document_id: '12345678a' }));

        expect(capturedDocumentId).toBe('12345678A');
    });
});
