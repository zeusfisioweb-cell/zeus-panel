import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppointmentInsertSchema, AppointmentUpdateSchema } from '@/lib/schemas';
import {
    assertSameOriginMutation,
    ApiRouteError,
    ensurePatientAccess,
    getBookingSettings,
    handleApiError,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../_lib';
import { isAlignedToInterval, findConflict, canCancel } from '@/lib/booking-validation';
import type { Appointment } from '@/lib/types';

const getAppointmentsQuerySchema = z.object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
});

const updateAppointmentSchema = AppointmentUpdateSchema.extend({
    id: z.string().min(1),
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

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const url = new URL(request.url);
        const parsed = getAppointmentsQuerySchema.parse({
            start_date: url.searchParams.get('start_date') ?? undefined,
            end_date: url.searchParams.get('end_date') ?? undefined,
        });

        let query = supabase
            .from('appointments')
            .select(appointmentSelect)
            .order('start_time', { ascending: true });

        if (parsed.start_date) {
            query = query.gte('start_time', parsed.start_date);
        }

        if (parsed.end_date) {
            query = query.lt('start_time', parsed.end_date);
        }

        if (scopedProfessionalId) {
            query = query.eq('professional_id', scopedProfessionalId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json((data ?? []).map(normalizeAppointmentRow));
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

        if (scopedProfessionalId && parsed.patient_id) {
            await ensurePatientAccess({
                supabase,
                role,
                professionalId: scopedProfessionalId,
                patientId: parsed.patient_id,
            });
        }

        if (scopedProfessionalId) {
            await ensureProfessionalServiceAccess(supabase, scopedProfessionalId, parsed.service_id);
        }

        const payload = {
            ...parsed,
            patient_id: parsed.patient_id ?? null,
            professional_id: scopedProfessionalId ?? (parsed.professional_id ?? null),
        };

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
                .eq('professional_id', payload.professional_id);
            if (conflictErr) throw conflictErr;
            const conflict = findConflict(startMs, endMs, settings.buffer_minutes, existing ?? []);
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

        return NextResponse.json(normalizeAppointmentRow(data));
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

        const isCancelling = cleanPayload.status === 'cancelled';
        const isChangingTiming = 'start_time' in cleanPayload || 'end_time' in cleanPayload || 'professional_id' in cleanPayload;

        let currentAppt: {
            id: string;
            patient_id: string | null;
            professional_id: string | null;
            start_time: string;
            end_time: string;
            status: string;
        } | null = null;

        if (scopedProfessionalId || isCancelling || isChangingTiming) {
            const { data: curr, error: currErr } = await supabase
                .from('appointments')
                .select('id, patient_id, professional_id, start_time, end_time, status')
                .eq('id', id)
                .maybeSingle();
            if (currErr) throw currErr;
            if (!curr) throw new ApiRouteError(404, 'Appointment not found');
            currentAppt = curr as typeof currentAppt;
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

        if (isChangingTiming && currentAppt) {
            const settings = await getBookingSettings(supabase);
            const effectiveStart = (cleanPayload.start_time as string | undefined) ?? currentAppt.start_time;
            const effectiveEnd = (cleanPayload.end_time as string | undefined) ?? currentAppt.end_time;
            const effectiveProfId = ('professional_id' in cleanPayload)
                ? (cleanPayload.professional_id as string | null)
                : currentAppt.professional_id;

            if (!isAlignedToInterval(effectiveStart, settings.slot_interval_minutes)) {
                throw new ApiRouteError(422, 'La hora de inicio no está alineada al intervalo de slots configurado');
            }

            if (effectiveProfId) {
                const startMs = new Date(effectiveStart).getTime();
                const endMs = new Date(effectiveEnd).getTime();
                const { data: existing, error: conflictErr } = await supabase
                    .from('appointments')
                    .select('id, start_time, end_time, status')
                    .eq('professional_id', effectiveProfId);
                if (conflictErr) throw conflictErr;
                const conflict = findConflict(startMs, endMs, settings.buffer_minutes, existing ?? [], id);
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
            .single();

        if (error) throw error;

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

        return NextResponse.json(normalizeAppointmentRow(data));
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
