import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';

const createScheduleSlotSchema = z.object({
    professional_id: z.string().min(1),
    day_of_week: z.number().int().min(1).max(7),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const parsed = createScheduleSlotSchema.parse(rawBody);

        const { data, error } = await supabase
            .from('schedule_slots')
            .insert(parsed)
            .select()
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'schedule_slots',
            recordId: data.id as string,
            details: { professional_id: parsed.professional_id },
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
