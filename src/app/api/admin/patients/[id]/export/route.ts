import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requirePanelAccess, writeAuditLog } from '../../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

/**
 * GDPR Data Export (Art. 20 - Right to Data Portability)
 * Returns all personal data related to a patient in JSON format.
 */
export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Only owners can export patient data
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);

        // 1. Get patient record
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('id', id)
            .single();

        if (patientError || !patient) {
            return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
        }

        // 2. Get all appointments for this patient
        const { data: appointments } = await supabase
            .from('appointments')
            .select('id, start_time, end_time, status, notes, patient_name, patient_phone, patient_email, source, cancellation_reason, created_at, updated_at, service:services(name, duration_minutes, price), professional:professionals(first_name, last_name)')
            .eq('patient_id', id)
            .order('start_time', { ascending: false });

        // 3. Get all clinical records for this patient
        const { data: clinicalRecords } = await supabase
            .from('clinical_records')
            .select('id, type, content, attachments, created_at, updated_at')
            .eq('patient_id', id)
            .order('created_at', { ascending: false });

        // 4. Get consent records for this patient
        const { data: consentRecords } = await supabase
            .from('consent_records')
            .select('id, consent_type, consent_text, granted, ip_address, user_agent, granted_at, revoked_at')
            .eq('patient_id', id)
            .order('granted_at', { ascending: false });

        // 5. Get audit logs referencing this patient
        const { data: auditLogs } = await supabase
            .from('audit_logs')
            .select('action, table_name, details, created_at')
            .eq('table_name', 'patients')
            .eq('record_id', id)
            .order('created_at', { ascending: false });

        // Audit this data export
        await writeAuditLog({
            supabase,
            userId,
            action: 'VIEW',
            tableName: 'patients',
            recordId: id,
            details: { type: 'gdpr_data_export' },
        });

        const exportData = {
            export_metadata: {
                exported_at: new Date().toISOString(),
                format_version: '1.0',
                data_controller: 'Zeus Fisioterapia',
                legal_basis: 'RGPD Art. 20 - Derecho a la portabilidad de datos',
            },
            personal_data: {
                first_name: patient.first_name,
                last_name: patient.last_name,
                email: patient.email,
                phone: patient.phone,
                document_id: patient.document_id,
                birth_date: patient.birth_date,
                address: patient.address,
                gdpr_consent: patient.gdpr_consent,
                marketing_consent: patient.marketing_consent,
                registered_at: patient.created_at,
                last_updated: patient.updated_at,
                deleted_at: patient.deleted_at,
            },
            appointments: (appointments ?? []).map((a) => ({
                date: a.start_time,
                end: a.end_time,
                status: a.status,
                notes: a.notes,
                service: a.service,
                professional: a.professional,
                source: a.source,
                cancellation_reason: a.cancellation_reason,
                created_at: a.created_at,
            })),
            clinical_records: (clinicalRecords ?? []).map((r) => ({
                type: r.type,
                content: r.content,
                attachments: r.attachments,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })),
            consent_records: (consentRecords ?? []).map((c) => ({
                type: c.consent_type,
                text: c.consent_text,
                granted: c.granted,
                granted_at: c.granted_at,
                revoked_at: c.revoked_at,
                ip_address: c.ip_address,
            })),
            data_access_log: (auditLogs ?? []).map((l) => ({
                action: l.action,
                details: l.details,
                at: l.created_at,
            })),
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="patient_${id}_gdpr_export.json"`,
            },
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
