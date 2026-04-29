import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: () => Response.json({ error: 'Internal Server Error' }, { status: 500 }),
}));

describe('admin schedule exceptions route RBAC', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('ignores requested professional_id and scopes GET to authenticated professional', async () => {
        const query = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            data: [],
            error: null,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await GET(
            new Request('http://localhost/api/admin/schedule-exceptions?professional_id=44444444-4444-4444-4444-444444444444')
        );

        expect(response.status).toBe(200);
        expect(query.eq).toHaveBeenCalledWith('professional_id', '33333333-3333-3333-3333-333333333333');
    });

    it('stores scoped professional id on POST for professional users', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: '99999999-9999-9999-9999-999999999999', professional_id: '33333333-3333-3333-3333-333333333333' },
            error: null,
        });
        const select = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select });
        const supabase = {
            from: vi.fn().mockReturnValue({ insert }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'pro-user-1',
            professionalId: '33333333-3333-3333-3333-333333333333',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('33333333-3333-3333-3333-333333333333');

        const response = await POST(
            new Request('http://localhost/api/admin/schedule-exceptions', {
                method: 'POST',
                body: JSON.stringify({
                    professional_id: '44444444-4444-4444-4444-444444444444',
                    exception_date: '2026-04-17',
                    is_available: false,
                    reason: 'vacaciones',
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                professional_id: '33333333-3333-3333-3333-333333333333',
            })
        );
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'pro-user-1',
                action: 'CREATE',
                tableName: 'schedule_exceptions',
                recordId: '99999999-9999-9999-9999-999999999999',
            })
        );
    });
});
