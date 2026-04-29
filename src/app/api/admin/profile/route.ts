import { NextResponse } from 'next/server';
import { handleApiError, requirePanelAccess } from '../_lib';

export async function GET() {
    try {
        const { supabase, userId, role, professionalId } = await requirePanelAccess();

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, full_name, created_at')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        return NextResponse.json({
            ...data,
            professional_id: role === 'professional' ? professionalId : null,
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
