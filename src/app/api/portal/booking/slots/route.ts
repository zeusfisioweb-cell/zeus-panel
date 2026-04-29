import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const professional_id = url.searchParams.get('professional_id');
        const date = url.searchParams.get('date');
        const duration_minutes = parseInt(url.searchParams.get('duration_minutes') ?? '0', 10);

        if (!professional_id || !date || !duration_minutes) {
            return NextResponse.json({ error: 'professional_id, date, duration_minutes required' }, { status: 400 });
        }

        const admin = getAdminSupabase();
        const { data, error } = await admin.rpc('get_available_slots', {
            p_professional_id: professional_id,
            p_date: date,
            p_duration_minutes: duration_minutes,
        });

        if (error) throw error;

        return NextResponse.json({ slots: data ?? [] });
    } catch (error) {
        return handleApiError(error);
    }
}
