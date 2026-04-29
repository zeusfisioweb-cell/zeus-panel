import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

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
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(`${userId}:${ip}`, 'admin-create-schedule-slot', 40, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }

        const rawBody = await request.json();
        const parsed = createScheduleSlotSchema.parse(rawBody);

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
