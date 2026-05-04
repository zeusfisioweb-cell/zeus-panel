import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, resolveScopedProfessionalId, writeAuditLog } from '../../_lib';
const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de excepción inválido' }),
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

        let deleteQuery = supabase
            .from('schedule_exceptions')
            .delete()
            .eq('id', id);

        if (scopedProfessionalId) {
            deleteQuery = deleteQuery.eq('professional_id', scopedProfessionalId);
        }

        const { error } = await deleteQuery;

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'schedule_exceptions',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
