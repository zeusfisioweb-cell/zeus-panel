import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ScheduleExceptionSchema } from '@/lib/schemas';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, resolveScopedProfessionalId, writeAuditLog } from '../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const getScheduleExceptionsQuerySchema = z.object({
    start_date: z.string().regex(dateRegex).optional(),
    end_date: z.string().regex(dateRegex).optional(),
    professional_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const url = new URL(request.url);
        const parsed = getScheduleExceptionsQuerySchema.parse({
            start_date: url.searchParams.get('start_date') ?? undefined,
            end_date: url.searchParams.get('end_date') ?? undefined,
            professional_id: url.searchParams.get('professional_id') ?? undefined,
        });

        const effectiveProfessionalId = scopedProfessionalId ?? parsed.professional_id;

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
        assertSameOriginMutation(request);
        const { supabase, role, professionalId, userId } = await requirePanelAccess();
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(`${userId}:${ip}`, 'admin-create-schedule-exception', 20, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }

        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const rawBody = await request.json();
        const parsed = ScheduleExceptionSchema.parse(rawBody);

        const payload = {
            ...parsed,
            professional_id: scopedProfessionalId ?? parsed.professional_id,
        };

        const { data, error } = await supabase
            .from('schedule_exceptions')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'schedule_exceptions',
            recordId: data.id as string,
            details: { professional_id: payload.professional_id },
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
