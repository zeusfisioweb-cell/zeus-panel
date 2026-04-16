import { NextResponse } from 'next/server';
import { handleApiError, requirePanelAccess } from '../_lib';

export async function GET() {
    try {
        const { supabase, userId } = await requirePanelAccess();

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
