import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ApiRouteError,
    assertSameOriginMutation,
    handleApiError,
    requirePanelAccess,
    writeAuditLog,
} from '../../_lib';

const PatchSchema = z.object({
    status: z.enum(['accepted', 'declined', 'expired']),
    resolution_note: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = await context.params;

        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            throw new ApiRouteError(400, 'ID inválido');
        }

        const raw = await request.json() as unknown;
        const body = PatchSchema.parse(raw);

        const { data: current, error: fetchError } = await supabase
            .from('appointment_requests')
            .select('id, status')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!current) throw new ApiRouteError(404, 'Solicitud no encontrada');
        if (current.status !== 'pending') {
            throw new ApiRouteError(409, 'La solicitud ya ha sido resuelta');
        }

        const { data: updated, error: updateError } = await supabase
            .from('appointment_requests')
            .update({
                status: body.status,
                resolution_note: body.resolution_note ?? null,
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
            })
            .eq('id', id)
            .eq('status', 'pending')
            .select('id, status')
            .maybeSingle();

        if (updateError) throw updateError;
        if (!updated) throw new ApiRouteError(409, 'La solicitud ya ha sido resuelta');

        try {
            await writeAuditLog({
                supabase,
                userId,
                action: 'UPDATE',
                tableName: 'appointment_requests',
                recordId: id,
                details: { status: body.status, resolution_note: body.resolution_note ?? null },
            });
        } catch (auditError) {
            console.error('[admin-api] appointment-request audit failed:', auditError);
        }

        return NextResponse.json({ ok: true, id, status: updated.status });
    } catch (error) {
        return handleApiError(error);
    }
}
