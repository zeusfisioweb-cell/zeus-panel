export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
export type AuditTable =
    | 'appointments'
    | 'patients'
    | 'clinical_records'
    | 'professionals'
    | 'services'
    | 'service_categories'
    | 'schedule_slots'
    | 'schedule_exceptions'
    | 'booking_settings';

interface AuditEventParams {
    action: AuditAction;
    table_name: AuditTable;
    record_id: string;
    details?: Record<string, unknown>;
}

/**
 * Writes an entry to audit_logs via server API.
 * Failures are logged to console but do not throw.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
    try {
        const response = await fetch('/api/admin/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const body = (await response.json()) as { error?: string };
                errorMessage = body.error || errorMessage;
            } catch {
                // Ignore response parse errors.
            }

            console.error('[Audit] Failed to write audit log:', errorMessage, params);
        }
    } catch (error: unknown) {
        console.error('[Audit] Unexpected error writing audit log:', error, params);
    }
}
