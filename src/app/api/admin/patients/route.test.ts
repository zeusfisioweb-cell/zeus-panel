import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const getProfessionalPatientIdsMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
    ensurePatientAccess: vi.fn(),
    getProfessionalPatientIds: getProfessionalPatientIdsMock,
    handleApiError: () => Response.json({ error: 'Internal Server Error' }, { status: 500 }),
    normalizeNullableText: (value: string | null | undefined) => value,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: vi.fn(),
}));

describe('admin patients route RBAC', () => {
    beforeEach(() => {
        getProfessionalPatientIdsMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
    });

    it('filters patient list by professional accessible ids', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
                data: [{ id: 'patient-1' }],
                count: 1,
                error: null,
            }),
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: 'professional-row-1',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('professional-row-1');
        getProfessionalPatientIdsMock.mockResolvedValue(['patient-1']);

        const response = await GET(new Request('http://localhost/api/admin/patients?page=1&pageSize=50'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(getProfessionalPatientIdsMock).toHaveBeenCalledWith(supabase, 'professional-row-1');
        expect(query.in).toHaveBeenCalledWith('id', ['patient-1']);
        expect(body).toEqual({
            data: [{ id: 'patient-1' }],
            count: 1,
        });
    });
});
