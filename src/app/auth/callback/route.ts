import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/app/api/admin/_lib';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser();

            // Only apply this guard for OAuth providers (Google, etc.), not email/password.
            const isOAuth = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

            if (user && isOAuth) {
                const adminSupabase = getAdminSupabase();
                const { data: linkedPatient } = await adminSupabase
                    .from('patients')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .is('deleted_at', null)
                    .maybeSingle();

                if (!linkedPatient) {
                    // Security: never auto-link by email on OAuth callback.
                    // Users must complete the explicit identity verification flow.
                    return NextResponse.redirect(`${origin}/portal/completar-perfil`);
                }

                return NextResponse.redirect(`${origin}${next}`);
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/portal/login?error=auth`);
}
