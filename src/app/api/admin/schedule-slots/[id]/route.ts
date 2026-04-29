import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de slot inválido' }),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(_request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const ip = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(`${userId}:${ip}`, 'admin-delete-schedule-slot', 40, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }

        const { id } = paramsSchema.parse(await context.params);

        const { error } = await supabase
            .from('schedule_slots')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'schedule_slots',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
