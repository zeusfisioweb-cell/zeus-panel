import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    assertSameOriginMutation,
    ApiRouteError,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de cita inválido' }),
});

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(_request);
        const ip = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'delete-appointment', 30, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const { id } = paramsSchema.parse(await context.params);

        let query = supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (scopedProfessionalId) {
            query = query.eq('professional_id', scopedProfessionalId);
        }

        const { data, error } = await query
            .select('id')
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new ApiRouteError(404, 'Appointment not found');

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'appointments',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
