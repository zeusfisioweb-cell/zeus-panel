import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requirePanelAccess } from '../../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

const scheduleSlotSchema = z.object({
    day_of_week: z.number().int().min(1).max(7),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
});

const upsertScheduleSchema = z.object({
    slots: z.array(scheduleSlotSchema),
});

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);

        const { data, error } = await supabase
            .from('schedule_slots')
            .select('*')
            .eq('professional_id', id);

        if (error) throw error;

        return NextResponse.json(data ?? []);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);
        const rawBody = await request.json();
        const parsed = upsertScheduleSchema.parse(rawBody);

        const { error: deleteError } = await supabase
            .from('schedule_slots')
            .delete()
            .eq('professional_id', id);

        if (deleteError) throw deleteError;

        if (parsed.slots.length > 0) {
            const rows = parsed.slots.map((slot) => ({
                professional_id: id,
                day_of_week: slot.day_of_week,
                start_time: slot.start_time,
                end_time: slot.end_time,
            }));

            const { error: insertError } = await supabase
                .from('schedule_slots')
                .insert(rows);

            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
