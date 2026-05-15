import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH, POST } from './route';

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
const sendAppointmentWhatsAppMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    ensurePatientAccess: ensurePatientAccessMock,
    getBookingSettings: getBookingSettingsMock,
    requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    selectAllRows: async (
        buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
    ) => {
        const { data, error } = await buildQuery(0, 999);
        if (error) throw error;
        return (data ?? []) as unknown[];
    },
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

vi.mock('@/lib/whatsapp', () => ({
    sendAppointmentWhatsApp: sendAppointmentWhatsAppMock,
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
        sendAppointmentWhatsAppMock.mockReset();
    });

    it('allows a professional to create an appointment linked to any patient without prior relationship', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '66666666-6666-6666-6666-666666666666', status: 'pending', professional: null },
            error: null,
        });
        const insertSelect = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select: insertSelect });
        const conflictQuery = {
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const professionalServiceLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { service_id: '44444444-4444-4444-4444-444444444444' },
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
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            service_id: '44444444-4444-4444-4444-444444444444',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            source: 'admin',
            status: 'pending',
        }));

        expect(response.status).toBe(200);
        expect(ensurePatientAccessMock).not.toHaveBeenCalled();
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                patient_id: '11111111-1111-1111-1111-111111111111',
                professional_id: '33333333-3333-3333-3333-333333333333',
            }),
        ]);
        expect(professionalServiceLookup.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
        expect(professionalServiceLookup.eq).toHaveBeenCalledWith('service_id', '44444444-4444-4444-4444-444444444444');
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
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await POST(createJsonRequest({
            patient_id: '11111111-1111-1111-1111-111111111111',
            service_id: '55555555-5555-5555-5555-555555555555',
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
                id: '66666666-6666-6666-6666-666666666666',
                patient_id: '11111111-1111-1111-1111-111111111111',
                professional_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
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
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        });

        const response = await PATCH(createJsonRequest({
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '22222222-2222-2222-2222-222222222222',
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
        expect(update).not.toHaveBeenCalled();
    });

    it('rejects appointments whose end time is not after start time on create', async () => {
        const supabase = {
            from: vi.fn(() => {
                throw new Error('Supabase should not be queried for invalid ranges');
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });

        const response = await POST(createJsonRequest({
            service_id: '44444444-4444-4444-4444-444444444444',
            start_time: '2026-04-16T10:00:00.000Z',
            end_time: '2026-04-16T09:00:00.000Z',
            source: 'admin',
            status: 'pending',
        }));
        const body = await response.json();

        expect(response.status).toBe(422);
        expect(body).toEqual({ error: 'La hora de fin debe ser posterior a la hora de inicio' });
    });

    it('rejects appointments whose end time is not after start time on update', async () => {
        const supabase = {
            from: vi.fn(() => {
                throw new Error('Supabase should not be queried for invalid ranges');
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });

        getBookingSettingsMock.mockResolvedValue({
            slot_interval_minutes: 30,
            buffer_minutes: 0,
            cancellation_hours: 24,
        });

        const response = await PATCH(createJsonRequest({
            id: '66666666-6666-6666-6666-666666666666',
            start_time: '2026-04-16T10:00:00.000Z',
            end_time: '2026-04-16T09:00:00.000Z',
        }));
        const body = await response.json();

        expect(response.status).toBe(422);
        expect(body).toEqual({ error: 'La hora de fin debe ser posterior a la hora de inicio' });
    });
});

describe('admin appointments route GET', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockClear();
        sendAppointmentWhatsAppMock.mockReset();
    });

    it('returns appointments for owner without professional filter', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
                data: [{ id: '66666666-6666-6666-6666-666666666666', professional: null }],
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

        const response = await GET(new Request('http://localhost/api/admin/appointments'));
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
    });

    it('filters appointments by professional when role is professional', async () => {
        const eqMock = vi.fn().mockReturnThis();
        const query = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            eq: eqMock,
            range: vi.fn().mockResolvedValue({
                data: [{ id: '66666666-6666-6666-6666-666666666666', professional: null }],
                error: null,
            }),
        };
        const supabase = { from: vi.fn().mockReturnValue(query) };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await GET(new Request('http://localhost/api/admin/appointments'));
        expect(response.status).toBe(200);
        expect(eqMock).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });

    it('accepts YYYY-MM-DD filters and normalizes them to ISO start-of-day', async () => {
        const gteMock = vi.fn().mockReturnThis();
        const ltMock = vi.fn().mockReturnThis();
        const query = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: gteMock,
            lt: ltMock,
            range: vi.fn().mockResolvedValue({
                data: [{ id: '77777777-7777-7777-7777-777777777777', professional: null }],
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

        const response = await GET(
            new Request('http://localhost/api/admin/appointments?start_date=2026-04-01&end_date=2026-05-01')
        );
        expect(response.status).toBe(200);
        expect(gteMock).toHaveBeenCalledWith('start_time', '2026-04-01T00:00:00.000Z');
        expect(ltMock).toHaveBeenCalledWith('start_time', '2026-05-01T00:00:00.000Z');
    });
});

describe('admin appointments route PATCH owner success', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockClear();
        getBookingSettingsMock.mockReset();
        writeAuditLogMock.mockReset();
        sendAppointmentWhatsAppMock.mockReset();
    });

    it('professional updates own appointment status successfully', async () => {
        const currentAppt = {
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            status: 'pending',
        };
        const maybeSingle = vi.fn().mockResolvedValue({ data: currentAppt, error: null });
        const updateMaybeSingle = vi.fn().mockResolvedValue({
            data: { ...currentAppt, status: 'confirmed', professional: null },
            error: null,
        });
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
                }
                return {
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    select: vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle }),
                };
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await PATCH(new Request('http://localhost/api/admin/appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('confirmed');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'appointments',
        }));
    });

    it('owner can update appointment status without timing checks', async () => {
        const currentAppt = {
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            status: 'pending',
        };
        const fetchCurrentAppt = vi.fn().mockResolvedValue({ data: currentAppt, error: null });
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
                start_time: '2026-04-16T09:00:00.000Z',
                professional: { profile: { full_name: 'Dra. Vega' } },
                patient: { first_name: 'Ana', last_name: 'López', phone: '600111222' },
                service: { name: 'Fisioterapia' },
            },
            error: null,
        });
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: fetchCurrentAppt,
                    };
                }
                return {
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    select: vi.fn().mockReturnValue({ maybeSingle }),
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

        const response = await PATCH(new Request('http://localhost/api/admin/appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('confirmed');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'appointments',
        }));
        expect(sendAppointmentWhatsAppMock).toHaveBeenCalledWith(expect.objectContaining({
            isReschedule: false,
        }));
    });

    it('does not send confirmation WhatsApp when appointment was already confirmed', async () => {
        const currentAppt = {
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            status: 'confirmed',
        };
        const fetchCurrentAppt = vi.fn().mockResolvedValue({ data: currentAppt, error: null });
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
                professional: null,
                patient: null,
                service: null,
            },
            error: null,
        });
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: fetchCurrentAppt,
                    };
                }
                return {
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    select: vi.fn().mockReturnValue({ maybeSingle }),
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

        const response = await PATCH(new Request('http://localhost/api/admin/appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
            }),
        }));

        expect(response.status).toBe(200);
        expect(sendAppointmentWhatsAppMock).not.toHaveBeenCalled();
    });

    it('owner can reschedule an appointment (timing change path)', async () => {
        const currentAppt = {
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            status: 'pending',
        };
        const fetchCurrentAppt = vi.fn().mockResolvedValue({ data: currentAppt, error: null });
        const updateMaybeSingle = vi.fn().mockResolvedValue({
            data: { ...currentAppt, start_time: '2026-04-17T09:00:00.000Z', end_time: '2026-04-17T10:00:00.000Z', professional: null },
            error: null,
        });
        // isChangingTiming=true so fetches current appt (callCount=1) then fetches conflict check (callCount=2) then update (callCount=3)
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    // fetch current appointment
                    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: fetchCurrentAppt };
                }
                if (callCount === 2) {
                    // conflict check: select.eq.gt.lt
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        gt: vi.fn().mockReturnThis(),
                        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
                    };
                }
                // update
                return {
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    select: vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle }),
                };
            }),
        };

        getBookingSettingsMock.mockResolvedValue({
            slot_interval_minutes: 30,
            buffer_minutes: 0,
            cancellation_hours: 24,
        });
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await PATCH(new Request('http://localhost/api/admin/appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '66666666-6666-6666-6666-666666666666',
                start_time: '2026-04-17T09:00:00.000Z',
                end_time: '2026-04-17T10:00:00.000Z',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.start_time).toBe('2026-04-17T09:00:00.000Z');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'appointments',
        }));
    });

    it('reject re-confirming a cancelled appointment when another confirmed appointment occupies the same slot', async () => {
        const cancelledAppt = {
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            status: 'cancelled',
        };
        const fetchCurrentAppt = vi.fn().mockResolvedValue({ data: cancelledAppt, error: null });
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: fetchCurrentAppt,
                    };
                }
                if (callCount === 2) {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        gt: vi.fn().mockReturnThis(),
                        lt: vi.fn().mockResolvedValue({ data: [{ id: 'other', start_time: '2026-04-16T09:00:00.000Z', end_time: '2026-04-16T09:30:00.000Z', status: 'confirmed' }], error: null }),
                    };
                }
                return {
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
                };
            }),
        };

        getBookingSettingsMock.mockResolvedValue({
            buffer_minutes: 0,
            slot_interval_minutes: 30,
        });
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await PATCH(new Request('http://localhost/api/admin/appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(422);
        expect(body.error).toContain('El horario solicitado no está disponible');
    });

    it('allow re-confirming a cancelled appointment when the slot is free', async () => {
        const cancelledAppt = {
            id: '66666666-6666-6666-6666-666666666666',
            patient_id: '11111111-1111-1111-1111-111111111111',
            professional_id: '33333333-3333-3333-3333-333333333333',
            start_time: '2026-04-16T09:00:00.000Z',
            end_time: '2026-04-16T10:00:00.000Z',
            status: 'cancelled',
        };
        const fetchCurrentAppt = vi.fn().mockResolvedValue({ data: cancelledAppt, error: null });
        const updatedData = {
            id: '66666666-6666-6666-6666-666666666666',
            status: 'confirmed',
            start_time: '2026-04-16T09:00:00.000Z',
            professional: { profile: { full_name: 'Dra. Vega' } },
            patient: { first_name: 'Ana', last_name: 'López', phone: '600111222' },
            service: { name: 'Fisioterapia' },
        };
        const maybeSingle = vi.fn().mockResolvedValue({ data: updatedData, error: null });
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: fetchCurrentAppt,
                    };
                }
                if (callCount === 2) {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        gt: vi.fn().mockReturnThis(),
                        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
                    };
                }
                return {
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    select: vi.fn().mockReturnValue({ maybeSingle }),
                };
            }),
        };

        getBookingSettingsMock.mockResolvedValue({
            buffer_minutes: 0,
            slot_interval_minutes: 30,
        });
        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        resolveScopedProfessionalIdMock.mockReturnValue(null);

        const response = await PATCH(new Request('http://localhost/api/admin/appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id: '66666666-6666-6666-6666-666666666666',
                status: 'confirmed',
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('confirmed');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE',
            tableName: 'appointments',
        }));
    });
});
