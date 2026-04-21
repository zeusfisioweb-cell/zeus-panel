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
            professionalId: 'professional-row-1',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('professional-row-1');

        const response = await GET(
            new Request('http://localhost/api/admin/schedule-exceptions?professional_id=other-prof')
        );

        expect(response.status).toBe(200);
        expect(query.eq).toHaveBeenCalledWith('professional_id', 'professional-row-1');
    });

    it('stores scoped professional id on POST for professional users', async () => {
        const single = vi.fn().mockResolvedValue({
            data: { id: 'exception-1', professional_id: 'professional-row-1' },
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
            professionalId: 'professional-row-1',
        });
        resolveScopedProfessionalIdMock.mockReturnValue('professional-row-1');

        const response = await POST(
            new Request('http://localhost/api/admin/schedule-exceptions', {
                method: 'POST',
                body: JSON.stringify({
                    professional_id: 'other-professional',
                    exception_date: '2026-04-17',
                    is_available: false,
                    reason: 'vacaciones',
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                professional_id: 'professional-row-1',
            })
        );
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'pro-user-1',
                action: 'CREATE',
                tableName: 'schedule_exceptions',
                recordId: 'exception-1',
            })
        );
    });
});
