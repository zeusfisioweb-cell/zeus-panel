import { z } from 'zod';
import { renderReceiptPdf } from '@/lib/receipt-pdf';
import type { PaymentMethod } from '@/lib/types';
import {
    ApiRouteError,
    ensurePatientAccess,
    getBookingSettings,
    handleApiError,
    requirePanelAccess,
    writeAuditLog,
} from '../../../_lib';

const ParamsSchema = z.object({
    id: z.string().uuid({ message: 'ID de cobro inválido' }),
});

interface PaymentReceiptRow {
    id: string;
    receipt_number: string;
    paid_at: string;
    amount: number;
    method: PaymentMethod;
    notes: string | null;
    patient_id: string;
    patient: {
        first_name: string;
        last_name: string;
        document_id: string | null;
        address: string | null;
    } | null;
    appointment: {
        start_time: string;
        service: { name: string } | null;
    } | null;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, userId, role, professionalId } = await requirePanelAccess();
        const { id } = ParamsSchema.parse(await params);

        const { data, error } = await supabase
            .from('payments')
            .select(`
                id,
                receipt_number,
                paid_at,
                amount,
                method,
                notes,
                patient_id,
                patient:patients (first_name, last_name, document_id, address),
                appointment:appointments (
                    start_time,
                    service:services (name)
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new ApiRouteError(404, 'Cobro no encontrado');
        }

        const payment = data as unknown as PaymentReceiptRow;

        await ensurePatientAccess({
            supabase,
            role,
            professionalId,
            patientId: payment.patient_id,
        });

        const settings = await getBookingSettings(supabase);

        const patientName = payment.patient
            ? `${payment.patient.first_name} ${payment.patient.last_name}`.trim()
            : 'Paciente';

        const bytes = await renderReceiptPdf({
            receiptNumber: payment.receipt_number,
            paidAt: payment.paid_at,
            amount: Number(payment.amount),
            method: payment.method,
            notes: payment.notes,
            patient: {
                fullName: patientName,
                documentId: payment.patient?.document_id ?? null,
                address: payment.patient?.address ?? null,
            },
            service: {
                name: payment.appointment?.service?.name ?? 'Servicio',
                appointmentStart: payment.appointment?.start_time ?? payment.paid_at,
            },
            clinic: {
                name: settings.clinic_name,
                nif: null,
                address: settings.address,
                phone: settings.phone,
                email: settings.email,
            },
        });

        await writeAuditLog({
            supabase,
            userId,
            action: 'VIEW',
            tableName: 'payments',
            recordId: payment.id,
            details: { kind: 'receipt_pdf', receipt_number: payment.receipt_number },
        });

        return new Response(Buffer.from(bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="recibo-${payment.receipt_number}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
