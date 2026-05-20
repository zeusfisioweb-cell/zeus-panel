import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ApiRouteError,
    assertSameOriginMutation,
    handleApiError,
    requirePanelAccess,
    writeAuditLog,
} from '../../_lib';

const ParamsSchema = z.object({
    id: z.string().uuid({ message: 'ID de cobro inválido' }),
});

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = ParamsSchema.parse(await params);

        const { data: existing, error: fetchError } = await supabase
            .from('payments')
            .select('id, receipt_number, amount, appointment_id')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existing) {
            throw new ApiRouteError(404, 'Cobro no encontrado');
        }

        const { error: deleteError } = await supabase
            .from('payments')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'payments',
            recordId: id,
            details: {
                receipt_number: existing.receipt_number,
                amount: existing.amount,
                appointment_id: existing.appointment_id,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
