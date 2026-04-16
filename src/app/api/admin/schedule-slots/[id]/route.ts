import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requirePanelAccess } from '../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);

        const { error } = await supabase
            .from('schedule_slots')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
