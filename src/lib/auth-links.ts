import type { SupabaseClient } from '@supabase/supabase-js';

interface BuildSetupLinkParams {
    adminAuthClient: SupabaseClient;
    email: string;
    appUrl: string | undefined;
    next?: string;
}

interface BuildSetupLinkResult {
    setupLink: string | null;
    error: unknown;
}

/**
 * Generates a recovery link that routes through our own /auth/callback using
 * token_hash + type (verifyOtp), avoiding PKCE code exchange which requires a
 * client-side code_verifier that admin-generated links never have.
 */
export async function buildProfessionalSetupLink({
    adminAuthClient,
    email,
    appUrl,
    next = '/auth/set-password',
}: BuildSetupLinkParams): Promise<BuildSetupLinkResult> {
    if (!appUrl) {
        return { setupLink: null, error: new Error('NEXT_PUBLIC_APP_URL is not configured') };
    }

    const origin = new URL(appUrl).origin;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await adminAuthClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
    });

    if (error || !data?.properties?.hashed_token) {
        return { setupLink: null, error: error ?? new Error('Missing hashed_token') };
    }

    const params = new URLSearchParams({
        token_hash: data.properties.hashed_token,
        type: 'recovery',
        next,
    });

    return {
        setupLink: `${origin}/auth/callback?${params.toString()}`,
        error: null,
    };
}
