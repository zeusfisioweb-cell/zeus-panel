import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ScheduleExceptionSchema } from '@/lib/schemas';
import { handleApiError, requirePanelAccess } from '../_lib';

const getScheduleExceptionsQuerySchema = z.object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    professional_id: z.string().optional(),
});

export async function GET(request: Request) {
    try {
        const { supabase, role, userId } = await requirePanelAccess();
        const url = new URL(request.url);
        const parsed = getScheduleExceptionsQuerySchema.parse({
            start_date: url.searchParams.get('start_date') ?? undefined,
            end_date: url.searchParams.get('end_date') ?? undefined,
            professional_id: url.searchParams.get('professional_id') ?? undefined,
        });

        const effectiveProfessionalId = role === 'professional' ? userId : parsed.professional_id;

        let query = supabase
            .from('schedule_exceptions')
            .select('*')
            .order('exception_date', { ascending: true });

        if (parsed.start_date) {
            query = query.gte('exception_date', parsed.start_date);
        }

        if (parsed.end_date) {
            query = query.lte('exception_date', parsed.end_date);
        }

        if (effectiveProfessionalId) {
            query = query.eq('professional_id', effectiveProfessionalId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json(data ?? []);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        const { supabase, role, userId } = await requirePanelAccess();
        const rawBody = await request.json();
        const parsed = ScheduleExceptionSchema.parse(rawBody);

        const payload = {
            ...parsed,
            professional_id: role === 'professional' ? userId : parsed.professional_id,
        };

        const { data, error } = await supabase
            .from('schedule_exceptions')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
