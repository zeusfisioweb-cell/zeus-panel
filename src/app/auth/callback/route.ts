import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_NEXT = '/auth/set-password';

function buildErrorRedirect(origin: string, next: string, reason: string): NextResponse {
    const url = new URL(next, origin);
    url.searchParams.set('auth_error', reason);
    return NextResponse.redirect(url);
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const origin = url.origin;
    const next = url.searchParams.get('next') || DEFAULT_NEXT;

    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') as EmailOtpType | null;
    const fragmentError = url.searchParams.get('error');

    if (fragmentError) {
        return buildErrorRedirect(origin, next, fragmentError);
    }

    const supabase = await createClient();

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
            console.error('auth/callback: exchangeCodeForSession failed', error);
            return buildErrorRedirect(origin, next, 'exchange_failed');
        }
        return NextResponse.redirect(new URL(next, origin));
    }

    if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (error) {
            console.error('auth/callback: verifyOtp failed', error);
            return buildErrorRedirect(origin, next, 'otp_failed');
        }
        return NextResponse.redirect(new URL(next, origin));
    }

    return buildErrorRedirect(origin, next, 'missing_token');
}
