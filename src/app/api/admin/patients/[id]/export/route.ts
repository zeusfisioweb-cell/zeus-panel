import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildMultiSectionCsv } from '@/lib/csv';
import { handleApiError, requirePanelAccess, writeAuditLog } from '../../../_lib';

const paramsSchema = z.object({
    id: z.string().min(1),
});

/**
 * GDPR Data Export (Art. 20 - Right to Data Portability)
 * Returns all personal data related to a patient in JSON format.
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Only owners can export patient data
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { id } = paramsSchema.parse(await context.params);
        const format = new URL(request.url).searchParams.get('format');

        // 1. Get patient record
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('id', id)
            .single();

        if (patientError || !patient) {
            return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
        }

        // CSV format branch — independent from JSON export path
        if (format === 'csv') {
            const { data: apptCsv, error: apptCsvError } = await supabase
                .from('appointments')
                .select('start_time, end_time, status, notes, service:services(name), professional:professionals(profile:profiles(full_name))')
                .eq('patient_id', id)
                .order('start_time', { ascending: false });
            if (apptCsvError) throw apptCsvError;

            const { data: recordsCsv, error: recordsCsvError } = await supabase
                .from('clinical_records')
                .select('type, content, created_at')
                .eq('patient_id', id)
                .order('created_at', { ascending: false });
            if (recordsCsvError) throw recordsCsvError;

            const patientRow: unknown[] = [
                patient.first_name ?? '',
                patient.last_name ?? '',
                patient.email ?? '',
                patient.phone ?? '',
                patient.document_id ?? '',
                patient.birth_date ?? '',
                patient.address ?? '',
                patient.gdpr_consent ? 'Sí' : 'No',
                patient.marketing_consent ? 'Sí' : 'No',
            ];

            const apptRows: unknown[][] = (apptCsv ?? []).map((a) => {
                const start = a.start_time ? new Date(a.start_time) : null;
                const dateStr = start ? start.toISOString().substring(0, 10) : '';
                const timeStr = start ? start.toISOString().substring(11, 16) : '';
                const service = (a.service as { name?: string } | null)?.name ?? '';
                const professional =
                    (a.professional as { profile?: { full_name?: string } | null } | null)
                        ?.profile?.full_name ?? '';
                return [dateStr, timeStr, service, professional, a.status ?? '', a.notes ?? ''];
            });

            const recordRows: unknown[][] = (recordsCsv ?? []).map((r) => {
                const created = r.created_at ? new Date(r.created_at).toISOString().substring(0, 10) : '';
                const contentStr = JSON.stringify(r.content ?? {}).substring(0, 500);
                return [r.type ?? '', created, contentStr];
            });

            const csv = buildMultiSectionCsv([
                {
                    title: 'DATOS DEL PACIENTE',
                    headers: [
                        'Nombre',
                        'Apellidos',
                        'Email',
                        'Teléfono',
                        'DNI/NIE',
                        'Fecha nacimiento',
                        'Dirección',
                        'RGPD',
                        'Marketing',
                    ],
                    rows: [patientRow],
                },
                {
                    title: 'CITAS',
                    headers: ['Fecha', 'Hora', 'Servicio', 'Profesional', 'Estado', 'Notas'],
                    rows: apptRows,
                },
                {
                    title: 'FICHAS CLÍNICAS',
                    headers: ['Tipo', 'Fecha', 'Contenido'],
                    rows: recordRows,
                },
            ]);

            await writeAuditLog({
                supabase,
                userId,
                action: 'VIEW',
                tableName: 'patients',
                recordId: id,
                details: { type: 'csv_export' },
            });

            const filename = `paciente_${id}_${new Date().toISOString().substring(0, 10)}.csv`;
            return new NextResponse('\uFEFF' + csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Cache-Control': 'no-store, private, max-age=0',
                    Pragma: 'no-cache',
                    Expires: '0',
                    'X-Content-Type-Options': 'nosniff',
                },
            });
        }

        // 2. Get all appointments for this patient
        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, start_time, end_time, status, notes, patient_name, patient_phone, patient_email, source, cancellation_reason, created_at, updated_at, service:services(name, duration_minutes, price), professional:professionals(first_name, last_name)')
            .eq('patient_id', id)
            .order('start_time', { ascending: false });
        if (appointmentsError) throw appointmentsError;

        // 3. Get all clinical records for this patient
        const { data: clinicalRecords, error: clinicalRecordsError } = await supabase
            .from('clinical_records')
            .select('id, type, content, attachments, created_at, updated_at')
            .eq('patient_id', id)
            .order('created_at', { ascending: false });
        if (clinicalRecordsError) throw clinicalRecordsError;

        // 4. Get consent records for this patient
        const { data: consentRecords, error: consentRecordsError } = await supabase
            .from('consent_records')
            .select('id, consent_type, consent_text, granted, ip_address, user_agent, granted_at, revoked_at')
            .eq('patient_id', id)
            .order('granted_at', { ascending: false });
        if (consentRecordsError) throw consentRecordsError;

        // 5. Get audit logs referencing this patient
        const { data: auditLogs, error: auditLogsError } = await supabase
            .from('audit_logs')
            .select('action, table_name, details, created_at')
            .eq('table_name', 'patients')
            .eq('record_id', id)
            .order('created_at', { ascending: false });
        if (auditLogsError) throw auditLogsError;

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
                'Cache-Control': 'no-store, private, max-age=0',
                Pragma: 'no-cache',
                Expires: '0',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
