import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';
const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de slot inválido' }),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(_request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);

        const { data, error } = await supabase
            .from('schedule_slots')
            .delete()
            .eq('id', id)
            .select('id')
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new ApiRouteError(404, 'Schedule slot not found');

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'schedule_slots',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
