import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';
const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'VIEW']);
const auditTableSchema = z.enum([
    'appointments',
    'patients',
    'clinical_records',
    'professionals',
    'services',
    'service_categories',
    'schedule_slots',
    'schedule_exceptions',
    'booking_settings',
]);

const createAuditEventSchema = z.object({
    action: auditActionSchema,
    table_name: auditTableSchema,
    record_id: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const parsed = createAuditEventSchema.parse(rawBody);

        await writeAuditLog({
            supabase,
            userId,
            action: parsed.action,
            tableName: parsed.table_name,
            recordId: parsed.record_id,
            details: parsed.details ?? null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
