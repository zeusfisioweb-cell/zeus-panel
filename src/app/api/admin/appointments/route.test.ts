import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH, POST } from './route';

const ApiRouteErrorMock = vi.hoisted(() => class ApiRouteError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
});

const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const getBookingSettingsMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() =>
    vi.fn((role: string, professionalId: string | null) => (role === 'professional' ? professionalId : null))
);
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    ensurePatientAccess: ensurePatientAccessMock,
    getBookingSettings: getBookingSettingsMock,
    requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

function createJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('admin appointments route RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        getBookingSettingsMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockClear();
        writeAuditLogMock.mockReset();
    });

    it('requires existing patient access when a professional creates a linked appointment', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'appointment-1', status: 'pending', professional: null },
            error: null,
        });
        const insertSelect = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select: insertSelect });
        const conflictQuery = {
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const professionalServiceLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { service_id: 'service-1' },
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professional_services') return professionalServiceLookup;
                if (table === 'appointments') return {
                    select: vi.fn().mockReturnValue(conflictQuery),
                    insert,
                };
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        getBookingSettingsMock.mockResolvedValue({
            slot_interval_minutes: 30,
            buffer_minutes: 0,
            cancellation_hours: 24,
        });
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'professional-1',
            professionalId: 'professional-row-1',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: 'patient-1',
            service_id: 'service-1',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            source: 'admin',
            status: 'pending',
        }));

        expect(response.status).toBe(200);
        expect(ensurePatientAccessMock).toHaveBeenCalledWith({
            supabase,
            role: 'professional',
            professionalId: 'professional-row-1',
            patientId: 'patient-1',
        });
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                patient_id: 'patient-1',
                professional_id: 'professional-row-1',
            }),
        ]);
        expect(professionalServiceLookup.eq).toHaveBeenCalledWith('professional_id', 'professional-row-1');
        expect(professionalServiceLookup.eq).toHaveBeenCalledWith('service_id', 'service-1');
    });

    it('blocks a professional from creating an appointment with a service not assigned to them', async () => {
        const professionalServiceLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };
        const insert = vi.fn();
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professional_services') return professionalServiceLookup;
                if (table === 'appointments') return { insert };
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'professional-1',
            professionalId: 'professional-row-1',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: 'patient-1',
            service_id: 'service-x',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            source: 'admin',
            status: 'pending',
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('blocks a professional from moving an appointment to another patient', async () => {
        const update = vi.fn().mockReturnThis();
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'appointment-1',
                patient_id: 'patient-1',
                professional_id: 'professional-1',
            },
            error: null,
        });
        const appointmentQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle,
            update,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(appointmentQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'professional-1',
            professionalId: 'professional-1',
        });

        const response = await PATCH(createJsonRequest({
            id: 'appointment-1',
            patient_id: 'patient-2',
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
        expect(update).not.toHaveBeenCalled();
    });
});
