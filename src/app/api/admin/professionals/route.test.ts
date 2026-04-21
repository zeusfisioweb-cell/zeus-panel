import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const requirePanelAccessMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    handleApiError: () => Response.json({ error: 'Internal Server Error' }, { status: 500 }),
    normalizeNullableText: (value: string | null | undefined) => value,
}));

describe('admin professionals route GET RBAC', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
    });

    it('returns only the authenticated professional record for professional users', async () => {
        const professionalQuery = {
            data: [
                {
                    id: 'professional-1',
                    user_id: 'user-1',
                    is_active: true,
                    profile: { role: 'professional', full_name: 'Pro Uno' },
                },
            ],
            error: null,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
        };

        const supabase = {
            from: vi.fn().mockReturnValue(professionalQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe('professional-1');
        expect(professionalQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(professionalQuery.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('filters out non-professional rows for owner users', async () => {
        const ownerQuery = {
            data: [
                {
                    id: 'owner-as-prof',
                    user_id: 'owner-user',
                    profile: { role: 'owner', full_name: 'Owner' },
                },
                {
                    id: 'professional-1',
                    user_id: 'user-1',
                    profile: { role: 'professional', full_name: 'Pro Uno' },
                },
            ],
            error: null,
            select: vi.fn().mockReturnThis(),
        };

        const supabase = {
            from: vi.fn().mockReturnValue(ownerQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-user',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe('professional-1');
    });
});

