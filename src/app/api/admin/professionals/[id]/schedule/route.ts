import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../../../_lib';
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de profesional inválido' }),
});

const scheduleSlotSchema = z.object({
    day_of_week: z.number().int().min(1).max(7),
    start_time: z.string().regex(timeRegex, { message: 'Formato inválido (HH:MM)' }),
    end_time: z.string().regex(timeRegex, { message: 'Formato inválido (HH:MM)' }),
}).refine((data) => data.end_time > data.start_time, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['end_time'],
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
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);
        const rawBody = await request.json();
        const parsed = upsertScheduleSchema.parse(rawBody);

        const { error: replaceError } = await supabase.rpc('replace_professional_schedule_slots', {
            p_professional_id: id,
            p_slots: parsed.slots,
        });
        if (replaceError) throw replaceError;

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'schedule_slots',
            recordId: id,
            details: { replaced_slots_count: parsed.slots.length },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
