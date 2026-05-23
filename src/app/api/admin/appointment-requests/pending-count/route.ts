import { NextResponse } from 'next/server';
import { handleApiError, requirePanelAccess, resolveScopedProfessionalId } from '../../_lib';

export async function GET() {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);

        let query = supabase
            .from('appointment_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (scopedProfessionalId) {
            query = query.eq('professional_id', scopedProfessionalId);
        }

        const { count, error } = await query;
        if (error) throw error;

        return NextResponse.json({ count: count ?? 0 });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
