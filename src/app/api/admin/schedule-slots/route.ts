import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';

function toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const createScheduleSlotSchema = z.object({
    professional_id: z.string().uuid({ message: 'ID de profesional inválido' }),
    day_of_week: z.number().int().min(1).max(7),
    start_time: z.string().regex(timeRegex, { message: 'Formato inválido (HH:MM)' }),
    end_time: z.string().regex(timeRegex, { message: 'Formato inválido (HH:MM)' }),
}).refine((data) => data.end_time > data.start_time, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['end_time'],
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const parsed = createScheduleSlotSchema.parse(rawBody);

        const { data: existingSlots, error: existingError } = await supabase
            .from('schedule_slots')
            .select('start_time, end_time')
            .eq('professional_id', parsed.professional_id)
            .eq('day_of_week', parsed.day_of_week);

        if (existingError) throw existingError;

        const newStart = toMinutes(parsed.start_time);
        const newEnd = toMinutes(parsed.end_time);
        const overlaps = (existingSlots ?? []).some(
            (slot) => newStart < toMinutes(slot.end_time) && newEnd > toMinutes(slot.start_time)
        );

        if (overlaps) {
            throw new ApiRouteError(422, 'El horario se solapa con otro tramo existente para ese día');
        }

        const { data, error } = await supabase
            .from('schedule_slots')
            .insert(parsed)
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('insert returned no data');

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
