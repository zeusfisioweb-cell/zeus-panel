import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentSchema } from '@/lib/schemas';
import {
    ApiRouteError,
    assertSameOriginMutation,
    ensurePatientAccess,
    handleApiError,
    normalizeNullableText,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../_lib';

const PAYMENT_SELECT = `
    *,
    appointment:appointments!inner (
        id,
        start_time,
        end_time,
        status,
        professional_id,
        service:services (id, name, price)
    ),
    patient:patients (id, first_name, last_name, document_id, email)
`;

const ListQuerySchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    method: z.enum(['cash', 'card', 'bizum', 'transfer', 'other']).optional(),
    appointment_id: z.string().uuid().optional(),
    patient_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const { searchParams } = new URL(request.url);
        const parsedQuery = ListQuerySchema.safeParse({
            from: searchParams.get('from') ?? undefined,
            to: searchParams.get('to') ?? undefined,
            method: searchParams.get('method') ?? undefined,
            appointment_id: searchParams.get('appointment_id') ?? undefined,
            patient_id: searchParams.get('patient_id') ?? undefined,
        });

        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: 'Invalid query', details: parsedQuery.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const filters = parsedQuery.data;
        let query = supabase
            .from('payments')
            .select(PAYMENT_SELECT)
            .order('paid_at', { ascending: false });

        if (filters.from) query = query.gte('paid_at', filters.from);
        if (filters.to) query = query.lte('paid_at', filters.to);
        if (filters.method) query = query.eq('method', filters.method);
        if (filters.appointment_id) query = query.eq('appointment_id', filters.appointment_id);
        if (filters.patient_id) query = query.eq('patient_id', filters.patient_id);

        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        if (scopedProfessionalId) {
            query = query.eq('appointment.professional_id', scopedProfessionalId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json(data ?? []);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId, role, professionalId } = await requirePanelAccess();
        const rawBody = await request.json();
        const parsed = PaymentSchema.parse(rawBody);

        const { data: appointment, error: appointmentError } = await supabase
            .from('appointments')
            .select('id, patient_id, professional_id, status')
            .eq('id', parsed.appointment_id)
            .maybeSingle();

        if (appointmentError) throw appointmentError;
        if (!appointment) {
            throw new ApiRouteError(404, 'Cita no encontrada');
        }

        if (!appointment.patient_id) {
            throw new ApiRouteError(400, 'La cita no tiene paciente vinculado: no se puede registrar cobro');
        }

        await ensurePatientAccess({
            supabase,
            role,
            professionalId,
            patientId: appointment.patient_id as string,
        });

        const payload = {
            appointment_id: parsed.appointment_id,
            patient_id: appointment.patient_id as string,
            amount: parsed.amount,
            method: parsed.method,
            paid_at: parsed.paid_at ?? new Date().toISOString(),
            notes: normalizeNullableText(parsed.notes ?? null),
            created_by: userId,
        };

        const { data, error } = await supabase
            .from('payments')
            .insert([payload])
            .select(PAYMENT_SELECT)
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'payments',
            recordId: data.id as string,
            details: {
                appointment_id: parsed.appointment_id,
                amount: parsed.amount,
                method: parsed.method,
            },
        });

        return NextResponse.json(data, { status: 201 });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
