import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const requirePanelAccessMock = vi.hoisted(() => vi.fn());

vi.mock('../_lib', () => ({
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    handleApiError: () => Response.json({ error: 'Internal Server Error' }, { status: 500 }),
    normalizeNullableText: (value: string | null | undefined) => value,
}));

describe('admin services route GET RBAC', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
    });

    it('returns only active assigned services for professional users', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'professional-1', is_active: true },
                error: null,
            }),
        };

        const servicesLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [
                    { service: { id: 'svc-1', name: 'Fisio', is_active: true } },
                    { service: { id: 'svc-2', name: 'Inactivo', is_active: false } },
                ],
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                if (table === 'professional_services') return servicesLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'svc-1', name: 'Fisio', is_active: true }]);
    });

    it('returns empty list when professional is inactive', async () => {
        const professionalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'professional-1', is_active: false },
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'professionals') return professionalLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'user-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([]);
    });

    it('returns full owner service list for owner users', async () => {
        const ownerLookup = {
            data: [{ id: 'svc-1', name: 'Fisio', is_active: true }],
            error: null,
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'services') return ownerLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([{ id: 'svc-1', name: 'Fisio', is_active: true }]);
    });
});

