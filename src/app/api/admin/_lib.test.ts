import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    ApiRouteError,
    ensurePatientAccess,
    getProfessionalPatientIds,
    handleApiError,
    normalizeNullableText,
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
            recordId: 'record-1',
            details: { source: 'test' },
        });

        expect(from).toHaveBeenCalledWith('audit_logs');
        expect(insert).toHaveBeenCalledWith({
            user_id: 'user-1',
            action: 'CREATE',
            table_name: 'patients',
            record_id: 'record-1',
            details: { source: 'test' },
        });
    });

    it('logs failures without throwing', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
        const from = vi.fn().mockReturnValue({ insert });

        await writeAuditLog({
            supabase: { from } as never,
            userId: 'user-1',
            action: 'UPDATE',
            tableName: 'patients',
            recordId: 'record-2',
        });

        expect(errorSpy).toHaveBeenCalledWith('[admin-api] Failed to write audit log:', 'insert failed');
    });
});

describe('patient access helpers', () => {
    it('collects patient ids linked through appointments and clinical records', async () => {
        const appointmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({
                data: [{ patient_id: 'patient-1' }, { patient_id: 'patient-2' }],
                error: null,
            }),
        };
        const recordsQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ patient_id: 'patient-2' }, { patient_id: 'patient-3' }],
                error: null,
            }),
        };
        const from = vi.fn()
            .mockReturnValueOnce(appointmentQuery)
            .mockReturnValueOnce(recordsQuery);

        const ids = await getProfessionalPatientIds({ from } as never, 'pro-1');

        expect(ids.sort()).toEqual(['patient-1', 'patient-2', 'patient-3']);
        expect(from).toHaveBeenNthCalledWith(1, 'appointments');
        expect(from).toHaveBeenNthCalledWith(2, 'clinical_records');
    });

    it('allows owner patient access without relation queries', async () => {
        const from = vi.fn();

        await expect(ensurePatientAccess({
            supabase: { from } as never,
            role: 'owner',
            userId: 'owner-1',
            patientId: 'patient-1',
        })).resolves.toBeUndefined();

        expect(from).not.toHaveBeenCalled();
    });

    it('rejects professionals without appointment or clinical record access', async () => {
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
            .mockReturnValueOnce(appointmentQuery)
            .mockReturnValueOnce(recordsQuery);

        await expect(ensurePatientAccess({
            supabase: { from } as never,
            role: 'professional',
            userId: 'pro-1',
            patientId: 'patient-1',
        })).rejects.toMatchObject({
            status: 403,
            message: 'Forbidden',
        });
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
        const supabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'pro-1' } },
                    error: null,
                }),
            },
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: { role: 'professional' },
                            error: null,
                        }),
                    }),
                }),
            }),
        };

        createClientMock.mockResolvedValue(supabase);

        const { requirePanelAccess } = await import('./_lib');

        await expect(requirePanelAccess({ ownerOnly: true })).rejects.toMatchObject({
            status: 403,
            message: 'Forbidden: owner role required',
        });
    });
});
