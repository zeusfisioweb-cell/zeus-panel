import { createClient } from '@/lib/supabase/client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';

interface AuditEventParams {
    action: AuditAction;
    table_name: string;
    record_id: string;
    details?: Record<string, unknown>;
}

/**
 * Writes an entry to the audit_logs table.
 * Should be called after successful mutations on sensitive data (patients, appointments, clinical records).
 * Failures are logged to console but do NOT throw — audit failures should not break user flows.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
    try {
        const supabase = createClient();
        const { error } = await supabase.from('audit_logs').insert({
            action: params.action,
            table_name: params.table_name,
            record_id: params.record_id,
            details: params.details ?? null,
        });

        if (error) {
            console.error('[Audit] Failed to write audit log:', error.message, params);
        }
    } catch (err) {
        console.error('[Audit] Unexpected error writing audit log:', err);
    }
}
