import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());

vi.mock('../../../_lib', () => ({
    ensurePatientAccess: ensurePatientAccessMock,
    requirePanelAccess: requirePanelAccessMock,
    handleApiError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return Response.json({ error: message }, { status: 500 });
    },
}));

describe('admin patient details route RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
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
            userId: 'professional-1',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await GET(
            new Request('http://localhost/api/admin/patients/patient-1/details'),
            { params: Promise.resolve({ id: 'patient-1' }) }
        );

        expect(response.status).toBe(200);
        expect(appointmentsQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-1');
        expect(appointmentsQuery.eq).toHaveBeenCalledWith('professional_id', 'professional-1');
        expect(recordsQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-1');
        expect(recordsQuery.eq).toHaveBeenCalledWith('professional_id', 'professional-1');
    });
});
