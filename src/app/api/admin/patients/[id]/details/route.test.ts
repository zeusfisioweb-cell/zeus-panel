import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() =>
    vi.fn((role: string, professionalId: string | null) => (role === 'professional' ? professionalId : null))
);

vi.mock('../../../_lib', () => ({
    ensurePatientAccess: ensurePatientAccessMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    handleApiError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return Response.json({ error: message }, { status: 500 });
    },
}));

describe('admin patient details route RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockClear();
    });

    it('filters appointments and clinical records to the authenticated professional', async () => {
        const appointmentsQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const recordsQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'appointments') return appointmentsQuery;
                if (table === 'clinical_records') return recordsQuery;
                throw new Error(`Unexpected table: ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await GET(
            new Request('http://localhost/api/admin/patients/patient-1/details'),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );

        expect(response.status).toBe(200);
        expect(appointmentsQuery.eq).toHaveBeenCalledWith('patient_id', '11111111-1111-1111-1111-111111111111');
        expect(appointmentsQuery.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
        expect(recordsQuery.eq).toHaveBeenCalledWith('patient_id', '11111111-1111-1111-1111-111111111111');
        expect(recordsQuery.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });
});
