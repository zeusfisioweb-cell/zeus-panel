import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const createClientMock = vi.hoisted(() => vi.fn());
const getAdminSupabaseMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/app/api/admin/_lib', () => ({
    getAdminSupabase: getAdminSupabaseMock,
}));

describe('auth callback route', () => {
    beforeEach(() => {
        createClientMock.mockReset();
        getAdminSupabaseMock.mockReset();
    });

    it('redirects OAuth users without linked patient to complete-profile', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            id: 'auth-user-1',
                            email: 'ana@example.com',
                            app_metadata: { provider: 'google' },
                        },
                    },
                }),
            },
        });

        const adminClient = {
            from: vi.fn(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            })),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await GET(
            new Request('http://localhost/auth/callback?code=test-code&next=%2Fportal%2Fmis-citas')
        );

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost/portal/completar-perfil');
    });

    it('redirects OAuth users with linked patient to requested next route', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            id: 'auth-user-2',
                            email: 'marta@example.com',
                            app_metadata: { provider: 'google' },
                        },
                    },
                }),
            },
        });

        const adminClient = {
            from: vi.fn(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'patient-1' } }),
            })),
        };
        getAdminSupabaseMock.mockReturnValue(adminClient);

        const response = await GET(
            new Request('http://localhost/auth/callback?code=test-code&next=%2Fportal%2Fmis-citas')
        );

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost/portal/mis-citas');
    });
});
