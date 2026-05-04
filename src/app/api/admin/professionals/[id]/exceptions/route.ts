import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, assertSameOriginMutation, handleApiError, normalizeNullableText, requirePanelAccess, resolveScopedProfessionalId, writeAuditLog } from '../../../_lib';
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de profesional inválido' }),
});

const createExceptionsSchema = z.object({
    start_date: z.string().regex(dateRegex, { message: 'Formato inválido (YYYY-MM-DD)' }),
    end_date: z.string().regex(dateRegex, { message: 'Formato inválido (YYYY-MM-DD)' }).optional().nullable(),
    reason: z.string().optional().nullable(),
    is_available: z.boolean().default(false),
});

function buildDateRange(startDateIso: string, endDateIso?: string | null): string[] {
    const start = new Date(startDateIso);
    const end = endDateIso ? new Date(endDateIso) : new Date(startDateIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid date range');
    }
    if (end < start) {
        throw new Error('La fecha de fin debe ser igual o posterior a la fecha de inicio');
    }

    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        if (scopedProfessionalId && id !== scopedProfessionalId) {
            throw new ApiRouteError(403, 'Forbidden');
        }

        const url = new URL(request.url);
        const fromDate = url.searchParams.get('from') || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('schedule_exceptions')
            .select('*')
            .eq('professional_id', id)
            .gte('exception_date', fromDate)
            .order('exception_date');

        if (error) throw error;
        return NextResponse.json(data ?? []);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(
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
        const parsed = createExceptionsSchema.parse(rawBody);

        const dateRange = buildDateRange(parsed.start_date, parsed.end_date);
        const rows = dateRange.map((date) => ({
            professional_id: id,
            exception_date: date,
            reason: normalizeNullableText(parsed.reason),
            is_available: parsed.is_available,
        }));

        const { error } = await supabase
            .from('schedule_exceptions')
            .insert(rows);

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'schedule_exceptions',
            recordId: id,
            details: { inserted_days: rows.length },
        });

        return NextResponse.json({ success: true, inserted: rows.length });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
