import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOriginMutation, getAdminSupabase, ApiRouteError, handleApiError } from '@/app/api/admin/_lib';
import { isAlignedToInterval, findConflict } from '@/lib/booking-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendAppointmentWhatsApp } from '@/lib/whatsapp';

const BookingSchema = z.object({
    service_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    for_patient_id: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
    gdpr_consent: z.literal(true, { errorMap: () => ({ message: 'Consentimiento RGPD requerido' }) }),
    informed_consent: z.literal(true, { errorMap: () => ({ message: 'Consentimiento informado requerido' }) }),
    marketing_consent: z.boolean().optional().default(false),
});

function computeAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
}

function toMadridDate(iso: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(iso));

    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}

interface AvailableSlot {
    slot_start: string;
    slot_end: string;
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'portal-booking-create', 12, 3600);
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
        if (userError || !user) throw new ApiRouteError(401, 'Unauthorized');

        const rawBody = await request.json() as unknown;
        const body = BookingSchema.parse(rawBody);

        const admin = getAdminSupabase();

        // Resolve self patient
        const { data: self, error: selfErr } = await admin
            .from('patients')
            .select('id, first_name, last_name, phone, email, document_id')
            .eq('auth_user_id', user.id)
            .is('deleted_at', null)
            .maybeSingle();
        if (selfErr) throw selfErr;
        if (!self) throw new ApiRouteError(403, 'Portal profile required. Complete tu perfil primero.');

        // Resolve target patient (self or dependiente)
        let patient = self as typeof self & { birth_date?: string | null };
        if (body.for_patient_id && body.for_patient_id !== self.id) {
            const { data: dep, error: depErr } = await admin
                .from('patients')
                .select('id, first_name, last_name, phone, email, document_id, birth_date')
                .eq('id', body.for_patient_id)
                .eq('guardian_auth_user_id', user.id)
                .is('deleted_at', null)
                .maybeSingle();
            if (depErr) throw depErr;
            if (!dep) throw new ApiRouteError(403, 'Dependiente no válido o sin acceso');
            if (!dep.birth_date) throw new ApiRouteError(422, 'Dependiente sin fecha de nacimiento registrada');
            if (computeAge(dep.birth_date) >= 16) throw new ApiRouteError(403, 'El paciente ya tiene autonomía sanitaria y debe gestionar sus propias citas');
            patient = dep;
        }

        // Validate service, professional, and their link in parallel
        const [svcRes, proRes, psRes, settingsRes] = await Promise.all([
            admin.from('services').select('id, name, duration_minutes').eq('id', body.service_id).eq('is_active', true).maybeSingle(),
            admin.from('professionals').select('id, profile:profiles(full_name)').eq('id', body.professional_id).eq('is_active', true).maybeSingle(),
            admin.from('professional_services').select('service_id').eq('professional_id', body.professional_id).eq('service_id', body.service_id).maybeSingle(),
            admin.from('booking_settings').select('booking_advance_days, min_booking_notice_hours, slot_interval_minutes, buffer_minutes, gdpr_text, informed_consent_text').limit(1).maybeSingle(),
        ]);

        if (!svcRes.data) throw new ApiRouteError(404, 'Servicio no encontrado o inactivo');
        if (!proRes.data) throw new ApiRouteError(404, 'Profesional no disponible');
        if (!psRes.data) throw new ApiRouteError(422, 'Ese profesional no ofrece este servicio');
        if (!settingsRes.data) throw new ApiRouteError(500, 'Configuración de reservas no disponible');

        const settings = settingsRes.data;
        const now = Date.now();
        const startMs = new Date(body.start_time).getTime();
        const endMs = new Date(body.end_time).getTime();

        if (endMs <= startMs) throw new ApiRouteError(422, 'El horario de fin debe ser posterior al de inicio');
        const expectedEndMs = startMs + svcRes.data.duration_minutes * 60000;
        if (endMs !== expectedEndMs) {
            throw new ApiRouteError(422, 'Duración de cita inválida para el servicio seleccionado');
        }

        const minStartMs = now + settings.min_booking_notice_hours * 3600000;
        if (startMs < minStartMs) {
            throw new ApiRouteError(422, `Las citas requieren mínimo ${settings.min_booking_notice_hours}h de antelación`);
        }


        if (!isAlignedToInterval(body.start_time, settings.slot_interval_minutes)) {
            throw new ApiRouteError(422, 'El horario seleccionado no coincide con el intervalo de slots configurado');
        }

        const { data: availableSlots, error: availableSlotsError } = await admin.rpc('get_available_slots', {
            p_professional_id: body.professional_id,
            p_date: toMadridDate(body.start_time),
            p_duration_minutes: svcRes.data.duration_minutes,
        });
        if (availableSlotsError) throw availableSlotsError;

        const isSlotAvailable = ((availableSlots ?? []) as AvailableSlot[]).some((slot) => {
            const slotStartMs = new Date(slot.slot_start).getTime();
            const slotEndMs = new Date(slot.slot_end).getTime();
            return slotStartMs === startMs && slotEndMs === expectedEndMs;
        });
        if (!isSlotAvailable) throw new ApiRouteError(409, 'slot_taken');

        // Conflict check with buffer
        const bufferMs = settings.buffer_minutes * 60000;
        const { data: existing, error: conflictErr } = await admin
            .from('appointments')
            .select('id, start_time, end_time, status')
            .eq('professional_id', body.professional_id)
            .gt('end_time', new Date(startMs - bufferMs).toISOString())
            .lt('start_time', new Date(endMs + bufferMs).toISOString());
        if (conflictErr) throw conflictErr;

        const conflict = findConflict(startMs, endMs, settings.buffer_minutes, existing ?? []);
        if (conflict) throw new ApiRouteError(409, 'slot_taken');

        // Insert appointment
        const { data: apt, error: aptErr } = await admin
            .from('appointments')
            .insert({
                patient_id: patient.id,
                professional_id: body.professional_id,
                service_id: body.service_id,
                start_time: body.start_time,
                end_time: body.end_time,
                status: 'confirmed',
                source: 'web',
                notes: body.notes ?? null,
                patient_name: `${patient.first_name} ${patient.last_name}`,
                patient_phone: patient.phone ?? null,
                patient_email: patient.email ?? null,
            })
            .select('id')
            .single();
        if (aptErr) throw aptErr;

        // Consent records (best-effort — don't fail booking if this fails)
        const consentRows = [
            { patient_id: patient.id, appointment_id: apt.id, consent_type: 'gdpr', granted: true, consent_text: settings.gdpr_text ?? 'Consentimiento RGPD' },
            { patient_id: patient.id, appointment_id: apt.id, consent_type: 'informed', granted: true, consent_text: settings.informed_consent_text ?? 'Consentimiento informado' },
            ...(body.marketing_consent ? [{ patient_id: patient.id, appointment_id: apt.id, consent_type: 'marketing', granted: true, consent_text: 'Consentimiento marketing' }] : []),
        ];
        await admin.from('consent_records').insert(consentRows).then(({ error }) => {
            if (error) console.error('[portal-booking] consent_records insert failed:', error.message);
        });

        // Audit log (best-effort)
        await admin.from('audit_logs').insert({
            user_id: user.id,
            action: 'CREATE',
            table_name: 'appointments',
            record_id: apt.id,
            details: { source: 'portal', patient_id: patient.id, for_dependiente: patient.id !== self.id },
        }).then(({ error }) => {
            if (error) console.error('[portal-booking] audit_log insert failed:', error.message);
        });

        const professionalName = ((proRes.data?.profile) as { full_name?: string } | null | undefined)?.full_name ?? '';
        if (patient.phone) {
            void sendAppointmentWhatsApp({
                patientName: `${patient.first_name} ${patient.last_name}`,
                patientPhone: patient.phone,
                serviceName: svcRes.data.name,
                professionalName,
                startTime: body.start_time,
                isReschedule: false,
            });
        }

        return NextResponse.json({ id: apt.id, service_name: svcRes.data.name });
    } catch (error) {
        return handleApiError(error);
    }
}
