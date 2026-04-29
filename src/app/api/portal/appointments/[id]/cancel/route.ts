import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { signCancelToken } from '@/lib/portal-token';
import { sendCancellationRequestEmail } from '@/lib/email';
import { canCancel } from '@/lib/booking-validation';
import { assertSameOriginMutation, ApiRouteError, getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const paramsSchema = z.object({
    id: z.string().uuid({ message: 'ID de cita inválido' }),
});

interface AppointmentRow {
    id: string;
    status: string;
    start_time: string;
    patient_id: string;
    patient: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        birth_date: string | null;
        guardian_auth_user_id: string | null;
    } | null;
    professionals: {
        profile: { full_name: string | null } | null;
    } | null;
    services: { name: string } | null;
}

function computeAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'portal-cancel-request', 6, 3600);
        if (!rl.success) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
                }
            );
        }

        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new ApiRouteError(401, 'Unauthorized');
        }

        const adminSupabase = getAdminSupabase();

        const { data: patient, error: patientError } = await adminSupabase
            .from('patients')
            .select('id, first_name, last_name, email')
            .eq('auth_user_id', user.id)
            .is('deleted_at', null)
            .maybeSingle();

        if (patientError) {
            throw new ApiRouteError(500, 'Internal Server Error');
        }

        if (!patient) {
            throw new ApiRouteError(404, 'No encontramos tu perfil de paciente');
        }

        const parseResult = paramsSchema.safeParse(await context.params);
        if (!parseResult.success) {
            return NextResponse.json(
                { error: parseResult.error.flatten().fieldErrors.id?.[0] ?? 'ID inválido' },
                { status: 400 }
            );
        }

        const { id: aptId } = parseResult.data;

        const { data: apt, error: aptError } = await adminSupabase
            .from('appointments')
            .select(`
                id, status, start_time, patient_id,
                patient:patients (
                    id, first_name, last_name, email, birth_date, guardian_auth_user_id
                ),
                professionals ( profile:profiles ( full_name ) ),
                services ( name )
            `)
            .eq('id', aptId)
            .maybeSingle();

        if (aptError) {
            throw new ApiRouteError(500, 'Internal Server Error');
        }

        if (!apt) {
            return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
        }

        const row = apt as unknown as AppointmentRow;
        const isOwnAppointment = row.patient_id === patient.id;
        const isDependentAppointment = row.patient?.guardian_auth_user_id === user.id;
        const dependentAge = row.patient?.birth_date ? computeAge(row.patient.birth_date) : null;

        if (!isOwnAppointment && !isDependentAppointment) {
            return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
        }

        if (isDependentAppointment && dependentAge !== null && dependentAge >= 16) {
            return NextResponse.json(
                { error: 'Esta cita ya no puede gestionarse como dependiente' },
                { status: 403 }
            );
        }

        if (row.status !== 'pending' && row.status !== 'confirmed') {
            return NextResponse.json(
                { error: 'Esta cita no se puede cancelar' },
                { status: 422 }
            );
        }

        const { data: settings } = await adminSupabase
            .from('booking_settings')
            .select('cancellation_hours')
            .limit(1)
            .maybeSingle();

        const cancellationHours = settings?.cancellation_hours ?? 24;

        if (!canCancel(new Date(), row.start_time, cancellationHours)) {
            return NextResponse.json(
                {
                    error: `Las cancelaciones deben solicitarse con al menos ${cancellationHours} horas de antelación`,
                },
                { status: 422 }
            );
        }

        const token = await signCancelToken(aptId, row.patient_id, user.id);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        const confirmLink = `${appUrl}/portal/cancel-confirm?token=${token}`;

        const patientName = row.patient
            ? `${row.patient.first_name ?? ''} ${row.patient.last_name ?? ''}`.trim()
            : `${patient.first_name} ${patient.last_name}`.trim();
        const professionalName = row.professionals?.profile?.full_name ?? 'el profesional';
        const serviceName = row.services?.name ?? 'tu cita';
        const appointmentDate = new Date(row.start_time).toLocaleString('es-ES', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        const emailTo = patient.email ?? row.patient?.email;
        if (!emailTo) {
            return NextResponse.json(
                { error: 'No hay dirección de email registrada para este paciente' },
                { status: 422 }
            );
        }

        await sendCancellationRequestEmail({
            to: emailTo,
            patientName,
            appointmentDate,
            serviceName,
            professionalName,
            confirmLink,
        });

        return NextResponse.json({ ok: true, emailSentTo: emailTo });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
