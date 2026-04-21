import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';

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

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    writeAuditLog: writeAuditLogMock,
    normalizeNullableText: (value: string | null | undefined) => {
        if (value == null) return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    },
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

const validPayload = {
    clinic_name: 'Zeus',
    phone: '   ',
    email: null,
    address: '  Main St  ',
    booking_advance_days: 30,
    min_booking_notice_hours: 12,
    cancellation_hours: 24,
    slot_interval_minutes: 30,
    buffer_minutes: 5,
    gdpr_text: null,
    informed_consent_text: null,
    privacy_policy_url: null,
    terms_url: null,
    opening_hour: '08:00',
    closing_hour: '20:00',
};

function createPatchRequest(body: unknown): Request {
    return new Request('http://localhost/api/admin/booking-settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

describe('admin booking settings route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('returns booking settings for authenticated panel users', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'settings-1', clinic_name: 'Zeus' },
            error: null,
        });
        const query = {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ id: 'settings-1', clinic_name: 'Zeus' });
        expect(requirePanelAccessMock).toHaveBeenCalledWith();
    });

    it('updates booking settings only with owner access', async () => {
        const currentSettingsQuery = {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: { id: 'settings-1' },
                error: null,
            }),
        };
        const updateSingle = vi.fn().mockResolvedValue({
            data: { id: 'settings-1', clinic_name: 'Zeus' },
            error: null,
        });
        const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
        const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
        const update = vi.fn().mockReturnValue({ eq: updateEq });
        const supabase = {
            from: vi.fn()
                .mockReturnValueOnce(currentSettingsQuery)
                .mockReturnValueOnce({ update }),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase, userId: 'owner-1' });

        const response = await PATCH(createPatchRequest(validPayload));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ id: 'settings-1', clinic_name: 'Zeus' });
        expect(requirePanelAccessMock).toHaveBeenCalledWith({ ownerOnly: true });
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            clinic_name: 'Zeus',
            phone: null,
            address: 'Main St',
        }));
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'UPDATE',
                tableName: 'booking_settings',
                recordId: 'settings-1',
            })
        );
    });

    it('returns 403 when a non-owner attempts to update settings', async () => {
        requirePanelAccessMock.mockRejectedValue(new ApiRouteErrorMock(403, 'Forbidden: owner role required'));

        const response = await PATCH(createPatchRequest(validPayload));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden: owner role required' });
    });

    it('returns 500 when supabase fails to read booking settings', async () => {
        const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'db read failed' },
        });
        const query = {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({ supabase });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
    });
});
