import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

// Initialize Supabase admin client (requires service role key)
// This bypasses RLS and can create users in auth.users
function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase Service Role Key');
    }

    return createSupabaseAdmin(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

export async function POST(request: Request) {
    try {
        // 1. Secure the endpoint: Verify the caller is authenticated and an owner
        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized: You must be logged in' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'owner') {
            return NextResponse.json({ error: 'Forbidden: Only owners can create professionals' }, { status: 403 });
        }

        const adminAuthClient = getAdminSupabase();

        // Only accept requests with expected data
        const body = await request.json();
        const { email, first_name, last_name, temp_password } = body;

        if (!email || !temp_password) {
            return NextResponse.json({ error: 'Email and temporary password are required' }, { status: 400 });
        }

        // 1. Create the user in auth.users
        const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
            email: email,
            password: temp_password,
            email_confirm: true, // Auto confirm so they can log in
            user_metadata: {
                full_name: `${first_name || ''} ${last_name || ''}`.trim(),
            }
        });

        if (authError) {
            console.error('Error creating auth user:', authError);
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        const userId = authData.user.id;

        // 2. We should also assign them the 'professional' role in profiles
        // (Usually handled by a trigger, but we can enforce it here if needed,
        //  but we'll assume the trigger creates it and we update the role).

        // Wait briefly for trigger to create the profile (if you have one)
        // If you don't use triggers to create profiles, we can just insert one:
        const { error: profileError } = await adminAuthClient
            .from('profiles')
            .upsert({
                id: userId,
                email: email,
                role: 'professional',
                full_name: `${first_name || ''} ${last_name || ''}`.trim(),
            });

        if (profileError) {
            console.error('Error creating profile, rolling back auth user:', profileError);
            // Rollback: delete the auth user to avoid leaving a zombie user without a profile
            await adminAuthClient.auth.admin.deleteUser(userId);
            return NextResponse.json(
                { error: `Error al crear el perfil del profesional: ${profileError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, user_id: userId });

    } catch (error: unknown) {
        console.error('Error in create-professional API:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
