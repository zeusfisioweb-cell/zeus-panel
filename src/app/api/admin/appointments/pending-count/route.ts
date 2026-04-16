import { NextResponse } from 'next/server';
import { handleApiError, requirePanelAccess } from '../../_lib';

export async function GET() {
    try {
        const { supabase, role, userId } = await requirePanelAccess();

        let query = supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (role === 'professional') {
            query = query.eq('professional_id', userId);
        }

        const { count, error } = await query;
        if (error) throw error;

        return NextResponse.json({ count: count ?? 0 });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
