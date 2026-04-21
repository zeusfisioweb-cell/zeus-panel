import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    assertSameOriginMutation,
    ApiRouteError,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(_request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        let query = supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (scopedProfessionalId) {
            query = query.eq('professional_id', scopedProfessionalId);
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
