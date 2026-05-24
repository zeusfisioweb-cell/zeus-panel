import { z } from 'zod';
import { rowsToCsv } from '@/lib/csv';
import { PAYMENT_METHOD_LABELS } from '@/lib/types';
import type { PaymentMethod } from '@/lib/types';
import {
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
} from '../../_lib';

const ExportQuerySchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});

interface PaymentRow {
    receipt_number: string;
    paid_at: string;
    amount: number;
    method: PaymentMethod;
    notes: string | null;
    patient: { first_name: string; last_name: string; document_id: string | null } | null;
    appointment:
        | {
              start_time: string;
              service: { name: string } | null;
              professional_id: string | null;
          }
        | null;
}

const CSV_HEADERS = [
    'Recibo',
    'Fecha cobro',
    'Importe',
    'Método',
    'Paciente',
    'DNI/NIF',
    'Servicio',
    'Fecha cita',
    'Notas',
];

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const { searchParams } = new URL(request.url);

        const parsed = ExportQuerySchema.safeParse({
            from: searchParams.get('from') ?? undefined,
            to: searchParams.get('to') ?? undefined,
        });

        if (!parsed.success) {
            return new Response(
                JSON.stringify({ error: 'Rango de fechas inválido' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let query = supabase
            .from('payments')
            .select(`
                receipt_number,
                paid_at,
                amount,
                method,
                notes,
                patient:patients (first_name, last_name, document_id),
                appointment:appointments!inner (
                    start_time,
                    professional_id,
                    service:services (name)
                )
            `)
            .order('paid_at', { ascending: true });

        if (parsed.data.from) query = query.gte('paid_at', parsed.data.from);
        if (parsed.data.to) query = query.lte('paid_at', parsed.data.to);

        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        if (scopedProfessionalId) {
            query = query.eq('appointment.professional_id', scopedProfessionalId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = ((data ?? []) as unknown as PaymentRow[]).map((row) => [
            row.receipt_number,
            row.paid_at,
            row.amount.toFixed(2),
            PAYMENT_METHOD_LABELS[row.method] ?? row.method,
            row.patient ? `${row.patient.first_name} ${row.patient.last_name}` : '',
            row.patient?.document_id ?? '',
            row.appointment?.service?.name ?? '',
            row.appointment?.start_time ?? '',
            row.notes ?? '',
        ]);

        const csv = rowsToCsv(CSV_HEADERS, rows);
        const bom = '﻿'; // Excel UTF-8 hint
        const filename = `cobros-${new Date().toISOString().slice(0, 10)}.csv`;

        return new Response(bom + csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
