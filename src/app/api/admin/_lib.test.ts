import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    ApiRouteError,
    assertSameOriginMutation,
    ensurePatientAccess,
    getProfessionalPatientIds,
    handleApiError,
    normalizeNullableText,
    resolveScopedProfessionalId,
    writeAuditLog,
} from './_lib';

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

describe('normalizeNullableText', () => {
    it('trims text and maps blank values to null', () => {
        expect(normalizeNullableText('  hello  ')).toBe('hello');
        expect(normalizeNullableText('   ')).toBeNull();
        expect(normalizeNullableText(null)).toBeNull();
        expect(normalizeNullableText(undefined)).toBeNull();
    });
});

describe('handleApiError', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('serializes ApiRouteError with its status', async () => {
        const response = handleApiError(new ApiRouteError(403, 'Forbidden'));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
    });

    it('serializes zod validation errors', async () => {
        const schema = z.object({
            email: z.string().email(),
        });
        const parsed = schema.safeParse({ email: 'invalid' });

        if (parsed.success) {
            throw new Error('Expected validation to fail');
        }

        const response = handleApiError(parsed.error);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid request data');
        expect(body.details.email).toBeDefined();
    });

    it('falls back to a generic 500 for unknown errors', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = handleApiError(new Error('boom'));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(errorSpy).toHaveBeenCalled();
    });
});

describe('writeAuditLog', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('writes audit rows with the authenticated user id', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null });
        const from = vi.fn().mockReturnValue({ insert });

        await writeAuditLog({
            supabase: { from } as never,
            userId: 'user-1',
            action: 'CREATE',
            tableName: 'patients',
            recordId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            details: { source: 'test' },
        });

        expect(from).toHaveBeenCalledWith('audit_logs');
        expect(insert).toHaveBeenCalledWith({
            user_id: 'user-1',
            action: 'CREATE',
            table_name: 'patients',
            record_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            details: { source: 'test' },
        });
    });

    it('throws when audit insert fails', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
        const from = vi.fn().mockReturnValue({ insert });

        await expect(writeAuditLog({
            supabase: { from } as never,
            userId: 'user-1',
            action: 'UPDATE',
            tableName: 'patients',
            recordId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        })).rejects.toMatchObject({
            status: 500,
            message: 'Audit log failed',
        });

        expect(errorSpy).toHaveBeenCalledWith('[admin-api] Failed to write audit log:', 'insert failed');
    });
});

describe('patient access helpers', () => {
    it('collects patient ids linked through assignments, appointments and clinical records', async () => {
        const assignmentsQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ patient_id: '00000000-0000-0000-0000-000000000000' }],
                error: null,
            }),
        };
        const appointmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({
                data: [{ patient_id: '11111111-1111-1111-1111-111111111111' }, { patient_id: '22222222-2222-2222-2222-222222222222' }],
                error: null,
            }),
        };
        const recordsQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ patient_id: '22222222-2222-2222-2222-222222222222' }, { patient_id: 'patient-3' }],
                error: null,
            }),
        };
        const from = vi.fn()
            .mockReturnValueOnce(assignmentsQuery)
            .mockReturnValueOnce(appointmentQuery)
            .mockReturnValueOnce(recordsQuery);

        const ids = await getProfessionalPatientIds({ from } as never, 'pro-1');

        expect(ids.sort()).toEqual(['00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'patient-3']);
        expect(from).toHaveBeenNthCalledWith(1, 'patient_professionals');
        expect(from).toHaveBeenNthCalledWith(2, 'appointments');
        expect(from).toHaveBeenNthCalledWith(3, 'clinical_records');
    });

    it('allows owner patient access without relation queries', async () => {
        const patientQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '11111111-1111-1111-1111-111111111111', deleted_at: null },
                error: null,
            }),
        };
        const from = vi.fn().mockReturnValueOnce(patientQuery);

        await expect(ensurePatientAccess({
            supabase: { from } as never,
            role: 'owner',
            professionalId: null,
            patientId: '11111111-1111-1111-1111-111111111111',
        })).resolves.toBeUndefined();

        expect(from).toHaveBeenCalledTimes(1);
        expect(from).toHaveBeenCalledWith('patients');
        expect(patientQuery.select).toHaveBeenCalledWith('id, deleted_at');
    });

    it('allows professionals with explicit patient assignment', async () => {
        const patientQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '11111111-1111-1111-1111-111111111111', deleted_at: null },
                error: null,
            }),
        };
        const assignmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { patient_id: '11111111-1111-1111-1111-111111111111' },
                error: null,
            }),
        };
        const from = vi.fn()
            .mockReturnValueOnce(patientQuery)
            .mockReturnValueOnce(assignmentQuery);

        await expect(ensurePatientAccess({
            supabase: { from } as never,
            role: 'professional',
            professionalId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            patientId: '11111111-1111-1111-1111-111111111111',
        })).resolves.toBeUndefined();

        expect(from).toHaveBeenNthCalledWith(2, 'patient_professionals');
    });

    it('rejects professionals without explicit, appointment or clinical record access', async () => {
        const patientQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '11111111-1111-1111-1111-111111111111', deleted_at: null },
                error: null,
            }),
        };
        const assignmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        const appointmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        const recordsQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        const from = vi.fn()
            .mockReturnValueOnce(patientQuery)
            .mockReturnValueOnce(assignmentQuery)
            .mockReturnValueOnce(appointmentQuery)
            .mockReturnValueOnce(recordsQuery);

        await expect(ensurePatientAccess({
            supabase: { from } as never,
            role: 'professional',
            professionalId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            patientId: '11111111-1111-1111-1111-111111111111',
        })).rejects.toMatchObject({
            status: 403,
            message: 'Forbidden',
        });
    });

    it('rejects soft-deleted patients before relation checks', async () => {
        const patientQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    id: '11111111-1111-1111-1111-111111111111',
                    deleted_at: '2026-04-25T10:00:00.000Z',
                },
                error: null,
            }),
        };
        const from = vi.fn().mockReturnValueOnce(patientQuery);

        await expect(ensurePatientAccess({
            supabase: { from } as never,
            role: 'professional',
            professionalId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            patientId: '11111111-1111-1111-1111-111111111111',
        })).rejects.toMatchObject({
            status: 404,
            message: 'Patient not found',
        });

        expect(from).toHaveBeenCalledTimes(1);
    });
});

describe('resolveScopedProfessionalId', () => {
    it('returns null for owners', () => {
        expect(resolveScopedProfessionalId('owner', null)).toBeNull();
    });

    it('returns professional id for professional role', () => {
        expect(resolveScopedProfessionalId('professional', 'cccccccc-cccc-cccc-cccc-cccccccccccc')).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    });

    it('throws when professional role has no mapped professional id', () => {
        expect(() => resolveScopedProfessionalId('professional', null)).toThrowError('Forbidden');
    });
});

describe('assertSameOriginMutation', () => {
    it('allows requests without origin header', () => {
        expect(() => assertSameOriginMutation(
            new Request('http://localhost/api/admin/services', {
                method: 'POST',
            })
        )).not.toThrow();
    });

    it('rejects explicit cross-site requests', () => {
        expect(() => assertSameOriginMutation(
            new Request('http://localhost/api/admin/services', {
                method: 'POST',
                headers: {
                    'sec-fetch-site': 'cross-site',
                },
            })
        )).toThrowError('Forbidden');
    });

    it('rejects mismatched origin host', () => {
        expect(() => assertSameOriginMutation(
            new Request('http://localhost/api/admin/services', {
                method: 'POST',
                headers: {
                    origin: 'https://evil.test',
                },
            })
        )).toThrowError('Forbidden');
    });
});

describe('requirePanelAccess', () => {
    afterEach(() => {
        createClientMock.mockReset();
        vi.restoreAllMocks();
    });

    it('throws 401 when there is no authenticated user', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: null,
                }),
            },
        });

        const { requirePanelAccess } = await import('./_lib');

        await expect(requirePanelAccess()).rejects.toMatchObject({
            status: 401,
            message: 'Unauthorized',
        });
    });

    it('throws 403 when the profile is missing', async () => {
        const from = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                }),
            }),
        });

        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'user-1' } },
                    error: null,
                }),
            },
            from,
        });

        const { requirePanelAccess } = await import('./_lib');

        await expect(requirePanelAccess()).rejects.toMatchObject({
            status: 403,
            message: 'Forbidden',
        });
    });

    it('allows owner access and returns the supabase client', async () => {
        const supabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'owner-1' } },
                    error: null,
                }),
            },
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: { role: 'owner' },
                            error: null,
                        }),
                    }),
                }),
            }),
        };

        createClientMock.mockResolvedValue(supabase);

        const { requirePanelAccess } = await import('./_lib');
        const result = await requirePanelAccess({ ownerOnly: true });

        expect(result).toMatchObject({
            role: 'owner',
            userId: 'owner-1',
            supabase,
        });
    });

    it('rejects non-owner access when ownerOnly is true', async () => {
        const profileQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'professional' },
                error: null,
            }),
        };
        const professionalQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', is_active: true },
                error: null,
            }),
        };
        const supabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'pro-1' } },
                    error: null,
                }),
            },
            from: vi.fn((table: string) => {
                if (table === 'profiles') return profileQuery;
                if (table === 'professionals') return professionalQuery;
                throw new Error(`Unexpected table: ${table}`);
            }),
        };

        createClientMock.mockResolvedValue(supabase);

        const { requirePanelAccess } = await import('./_lib');

        await expect(requirePanelAccess({ ownerOnly: true })).rejects.toMatchObject({
            status: 403,
            message: 'Forbidden: owner role required',
        });
    });

    it('rejects inactive professionals', async () => {
        const profileQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'professional' },
                error: null,
            }),
        };
        const professionalQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', is_active: false },
                error: null,
            }),
        };
        const supabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'pro-1' } },
                    error: null,
                }),
            },
            from: vi.fn((table: string) => {
                if (table === 'profiles') return profileQuery;
                if (table === 'professionals') return professionalQuery;
                throw new Error(`Unexpected table: ${table}`);
            }),
        };

        createClientMock.mockResolvedValue(supabase);

        const { requirePanelAccess } = await import('./_lib');

        await expect(requirePanelAccess()).rejects.toMatchObject({
            status: 403,
            message: 'Forbidden',
        });
    });
});
