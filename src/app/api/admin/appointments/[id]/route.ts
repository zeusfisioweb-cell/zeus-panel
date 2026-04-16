import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, role, userId } = await requirePanelAccess();
        const { id } = paramsSchema.parse(await context.params);

        let query = supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (role === 'professional') {
            query = query.eq('professional_id', userId);
        }

        const { data, error } = await query
            .select('id')
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new ApiRouteError(404, 'Appointment not found');

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'appointments',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
