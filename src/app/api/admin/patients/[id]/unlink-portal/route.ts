import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../../../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(`${userId}:${ip}`, 'admin-unlink-portal-access', 20, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }

        const { id } = paramsSchema.parse(await context.params);

        const { error } = await supabase
            .from('patients')
            .update({ auth_user_id: null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .is('deleted_at', null);

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'patients',
            recordId: id,
            details: { unlink_portal: true },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
