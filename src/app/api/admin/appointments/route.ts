import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppointmentInsertSchema, AppointmentUpdateSchema } from '@/lib/schemas';
import {
    assertSameOriginMutation,
    ApiRouteError,
    getBookingSettings,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    selectAllRows,
    writeAuditLog,
} from '../_lib';
import { isAlignedToInterval, findConflict, canCancel } from '@/lib/booking-validation';
import { sendAppointmentWhatsApp } from '@/lib/whatsapp';
import { sendPanelAppointmentPush } from '@/lib/push-notifications';
import type { Appointment } from '@/lib/types';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid date format' });

const getAppointmentsQuerySchema = z.object({
    start_date: z.union([z.string().datetime({ offset: true }), isoDateSchema]).optional(),
    end_date: z.union([z.string().datetime({ offset: true }), isoDateSchema]).optional(),
});

const updateAppointmentSchema = AppointmentUpdateSchema.extend({
    id: z.string().uuid({ message: 'ID de cita inválido' }),
});

const appointmentSelect = `
    id,
    patient_id,
    professional_id,
    service_id,
    start_time,
    end_time,
    status,
    notes,
    patient_name,
    patient_phone,
    patient_email,
    source,
    cancellation_reason,
    created_at,
    updated_at,
    patient:patients(id, first_name, last_name, document_id, phone, email),
    professional:professionals(id, color_code, profile:profiles(full_name)),
    service:services(id, name, duration_minutes, price, category:service_categories(color))
`;

type PanelAccessContext = Awaited<ReturnType<typeof requirePanelAccess>>;
type PanelSupabaseClient = PanelAccessContext['supabase'];

function normalizeAppointmentRow(row: unknown): Appointment {
    const record = row as Record<string, unknown>;
    const professionalRaw = record.professional as Record<string, unknown> | null | undefined;

    if (!professionalRaw) {
        return record as unknown as Appointment;
    }

    const nestedProfile = professionalRaw.profile ?? professionalRaw.profiles ?? null;
    const profile = Array.isArray(nestedProfile) ? (nestedProfile[0] as Record<string, unknown> | null) : nestedProfile;

    return {
        ...record,
        professional: {
            ...professionalRaw,
            profile: profile ?? null,
        },
    } as unknown as Appointment;
}

async function ensureProfessionalServiceAccess(
    supabase: PanelSupabaseClient,
    professionalId: string,
    serviceId: string
): Promise<void> {
    const { data, error } = await supabase
        .from('professional_services')
        .select('service_id')
        .eq('professional_id', professionalId)
        .eq('service_id', serviceId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiRouteError(403, 'Forbidden');
}

function ensureValidAppointmentRange(startTime: string, endTime: string): void {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        throw new ApiRouteError(400, 'Invalid appointment time range');
    }

    if (endMs <= startMs) {
        throw new ApiRouteError(422, 'La hora de fin debe ser posterior a la hora de inicio');
    }
}

function normalizeDateFilter(value: string): string {
    if (isoDateSchema.safeParse(value).success) {
        return `${value}T00:00:00.000Z`;
    }
    return value;
}

function sendWhatsAppForAppointment(appointment: Appointment, isReschedule: boolean): Promise<void> {
    const patientName = appointment.patient
        ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
        : (appointment.patient_name ?? 'Paciente');
    const patientPhone = appointment.patient?.phone ?? null;
    const serviceName = appointment.service?.name ?? '';
    const professionalName = appointment.professional?.profile?.full_name ?? '';

    if (!patientPhone) return Promise.resolve();

    return sendAppointmentWhatsApp({
        patientName,
        patientPhone,
        serviceName,
        professionalName,
        startTime: appointment.start_time,
        isReschedule,
    });
}

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const url = new URL(request.url);
        const parsed = getAppointmentsQuerySchema.parse({
            start_date: url.searchParams.get('start_date') ?? undefined,
            end_date: url.searchParams.get('end_date') ?? undefined,
        });

        const rows = await selectAllRows<unknown>((from, to) => {
            let query = supabase.from('appointments').select(appointmentSelect);

            if (parsed.start_date) {
                query = query.gte('start_time', normalizeDateFilter(parsed.start_date));
            }

            if (parsed.end_date) {
                query = query.lt('start_time', normalizeDateFilter(parsed.end_date));
            }

            if (scopedProfessionalId) {
                query = query.eq('professional_id', scopedProfessionalId);
            }

            return query.order('start_time', { ascending: true }).range(from, to);
        });

        return NextResponse.json(rows.map(normalizeAppointmentRow));
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const rawBody = await request.json();
        const parsed = AppointmentInsertSchema.parse(rawBody);

        if (scopedProfessionalId) {
            await ensureProfessionalServiceAccess(supabase, scopedProfessionalId, parsed.service_id);
        }

        const payload = {
            ...parsed,
            patient_id: parsed.patient_id ?? null,
            professional_id: scopedProfessionalId ?? (parsed.professional_id ?? null),
        };

        ensureValidAppointmentRange(parsed.start_time, parsed.end_time);

        const settings = await getBookingSettings(supabase);

        if (!isAlignedToInterval(parsed.start_time, settings.slot_interval_minutes)) {
            throw new ApiRouteError(422, 'La hora de inicio no está alineada al intervalo de slots configurado');
        }

        if (payload.professional_id) {
            const startMs = new Date(parsed.start_time).getTime();
            const endMs = new Date(parsed.end_time).getTime();
            const { data: existing, error: conflictErr } = await supabase
                .from('appointments')
                .select('id, start_time, end_time, status')
                .eq('professional_id', payload.professional_id)
                .gt('end_time', new Date(startMs).toISOString())
                .lt('start_time', new Date(endMs).toISOString());
            if (conflictErr) throw conflictErr;
            const conflict = findConflict(startMs, endMs, 0, existing ?? []);
            if (conflict) {
                throw new ApiRouteError(422, 'El horario solicitado no está disponible (conflicto con otra cita)');
            }
        }

        const { data, error } = await supabase
            .from('appointments')
            .insert([payload])
            .select(appointmentSelect)
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'appointments',
            recordId: data.id as string,
            details: {
                status: data.status,
            },
        });

        const normalized = normalizeAppointmentRow(data);
        void sendWhatsAppForAppointment(normalized, false);
        void sendPanelAppointmentPush({
            kind: 'created',
            patientName: normalized.patient_name ?? '',
            serviceName: normalized.service?.name ?? '',
            startTime: normalized.start_time,
        });

        return NextResponse.json(normalized);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const rawBody = await request.json();
        const parsed = updateAppointmentSchema.parse(rawBody);
        const { id, ...updateData } = parsed;

        const cleanPayload = Object.fromEntries(
            Object.entries(updateData).filter(([, value]) => value !== undefined)
        ) as Record<string, unknown>;

        if (Object.keys(cleanPayload).length === 0) {
            throw new ApiRouteError(400, 'No changes provided');
        }

        if (typeof cleanPayload.start_time === 'string' && typeof cleanPayload.end_time === 'string') {
            ensureValidAppointmentRange(cleanPayload.start_time, cleanPayload.end_time);
        }

        const isCancelling = cleanPayload.status === 'cancelled';
        const isConfirming = cleanPayload.status === 'confirmed';
        const isChangingTiming = 'start_time' in cleanPayload || 'end_time' in cleanPayload || 'professional_id' in cleanPayload;

        type CurrentAppt = {
            id: string;
            patient_id: string | null;
            professional_id: string | null;
            start_time: string;
            end_time: string;
            status: string;
        };

        let currentAppt: CurrentAppt | null = null;

        if (scopedProfessionalId || isCancelling || isConfirming || isChangingTiming) {
            const { data: curr, error: currErr } = await supabase
                .from('appointments')
                .select('id, patient_id, professional_id, start_time, end_time, status')
                .eq('id', id)
                .maybeSingle();
            if (currErr) throw currErr;
            if (!curr) throw new ApiRouteError(404, 'Appointment not found');
            currentAppt = curr as CurrentAppt;
        }

        if (scopedProfessionalId && currentAppt) {
            if (currentAppt.professional_id !== scopedProfessionalId) {
                throw new ApiRouteError(404, 'Appointment not found');
            }
            if ('professional_id' in cleanPayload && cleanPayload.professional_id !== scopedProfessionalId) {
                throw new ApiRouteError(403, 'Forbidden');
            }
            if ('patient_id' in cleanPayload && cleanPayload.patient_id !== currentAppt.patient_id) {
                throw new ApiRouteError(403, 'Forbidden');
            }
            if ('service_id' in cleanPayload && typeof cleanPayload.service_id === 'string') {
                await ensureProfessionalServiceAccess(supabase, scopedProfessionalId, cleanPayload.service_id);
            }
        }

        if (isCancelling && currentAppt && currentAppt.status !== 'cancelled') {
            const settings = await getBookingSettings(supabase);
            if (role !== 'owner' && !canCancel(new Date(), currentAppt.start_time, settings.cancellation_hours)) {
                throw new ApiRouteError(422, 'El plazo para cancelar esta cita ha expirado');
            }
        }

        const isReconfirmingCancelled = isConfirming && currentAppt && currentAppt.status === 'cancelled';
        const needsConflictCheck = isChangingTiming || isReconfirmingCancelled;

        if (needsConflictCheck && currentAppt) {
            const settings = await getBookingSettings(supabase);
            const effectiveStart = isChangingTiming
                ? ((cleanPayload.start_time as string | undefined) ?? currentAppt.start_time)
                : currentAppt.start_time;
            const effectiveEnd = isChangingTiming
                ? ((cleanPayload.end_time as string | undefined) ?? currentAppt.end_time)
                : currentAppt.end_time;
            const effectiveProfId = isChangingTiming && 'professional_id' in cleanPayload
                ? (cleanPayload.professional_id as string | null)
                : currentAppt.professional_id;

            ensureValidAppointmentRange(effectiveStart, effectiveEnd);

            if (!isAlignedToInterval(effectiveStart, settings.slot_interval_minutes)) {
                throw new ApiRouteError(422, 'La hora de inicio no está alineada al intervalo de slots configurado');
            }

            if (effectiveProfId) {
                const startMs = new Date(effectiveStart).getTime();
                const endMs = new Date(effectiveEnd).getTime();
                const { data: existing, error: conflictErr } = await supabase
                    .from('appointments')
                    .select('id, start_time, end_time, status')
                    .eq('professional_id', effectiveProfId)
                    .gt('end_time', new Date(startMs).toISOString())
                    .lt('start_time', new Date(endMs).toISOString());
                if (conflictErr) throw conflictErr;
                const conflict = findConflict(startMs, endMs, 0, existing ?? [], id);
                if (conflict) {
                    throw new ApiRouteError(422, 'El horario solicitado no está disponible (conflicto con otra cita)');
                }
            }
        }

        let query = supabase
            .from('appointments')
            .update(cleanPayload)
            .eq('id', id);

        if (scopedProfessionalId) {
            query = query.eq('professional_id', scopedProfessionalId);
        }

        const { data, error } = await query
            .select(appointmentSelect)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new ApiRouteError(404, 'Appointment not found or access denied');

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'appointments',
            recordId: data.id as string,
            details: {
                status: data.status,
            },
        });

        const updated = normalizeAppointmentRow(data);

        if (isChangingTiming) {
            void sendWhatsAppForAppointment(updated, true);
        } else if (isConfirming && currentAppt && currentAppt.status !== 'confirmed') {
            void sendWhatsAppForAppointment(updated, false);
        }
        if (isCancelling && currentAppt && currentAppt.status !== 'cancelled') {
            void sendPanelAppointmentPush({
                kind: 'cancelled',
                patientName: updated.patient_name ?? '',
                serviceName: updated.service?.name ?? '',
                startTime: updated.start_time,
            });
        }

        return NextResponse.json(updated);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
