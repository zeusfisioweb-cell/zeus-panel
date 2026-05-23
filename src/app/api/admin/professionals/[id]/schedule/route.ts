import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, assertSameOriginMutation, getAdminSupabase, handleApiError, requirePanelAccess, resolveScopedProfessionalId, writeAuditLog } from '../../../_lib';
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
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        if (scopedProfessionalId && id !== scopedProfessionalId) {
            throw new ApiRouteError(403, 'Forbidden');
        }

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
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        if (scopedProfessionalId && id !== scopedProfessionalId) {
            throw new ApiRouteError(403, 'Forbidden');
        }
        const rawBody = await request.json();
        const parsed = upsertScheduleSchema.parse(rawBody);

        const adminClient = getAdminSupabase();

        const { error: deleteSlotsError } = await adminClient
            .from('schedule_slots')
            .delete()
            .eq('professional_id', id);
        if (deleteSlotsError) throw deleteSlotsError;

        if (parsed.slots.length > 0) {
            const rows = parsed.slots.map((slot) => ({
                professional_id: id,
                day_of_week: slot.day_of_week,
                start_time: slot.start_time,
                end_time: slot.end_time,
                is_active: true,
            }));
            const { error: insertSlotsError } = await adminClient
                .from('schedule_slots')
                .insert(rows);
            if (insertSlotsError) throw insertSlotsError;
        }

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
