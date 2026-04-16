import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppointmentInsertSchema, AppointmentUpdateSchema } from '@/lib/schemas';
import { ApiRouteError, ensurePatientAccess, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';
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

interface AppointmentAccessRow {
    id: string;
    patient_id: string | null;
    professional_id: string | null;
}

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

export async function GET(request: Request) {
    try {
        const { supabase, role, userId } = await requirePanelAccess();
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

        if (role === 'professional') {
            query = query.eq('professional_id', userId);
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
        const { supabase, role, userId } = await requirePanelAccess();
        const rawBody = await request.json();
        const parsed = AppointmentInsertSchema.parse(rawBody);

        if (role === 'professional' && parsed.patient_id) {
            await ensurePatientAccess({
                supabase,
                role,
                userId,
                patientId: parsed.patient_id,
            });
        }

        const payload = {
            ...parsed,
            patient_id: parsed.patient_id ?? null,
            professional_id: role === 'professional' ? userId : (parsed.professional_id ?? null),
        };

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
        const { supabase, role, userId } = await requirePanelAccess();
        const rawBody = await request.json();
        const parsed = updateAppointmentSchema.parse(rawBody);
        const { id, ...updateData } = parsed;

        const cleanPayload = Object.fromEntries(
            Object.entries(updateData).filter(([, value]) => value !== undefined)
        ) as Record<string, unknown>;

        if (Object.keys(cleanPayload).length === 0) {
            throw new ApiRouteError(400, 'No changes provided');
        }

        if (role === 'professional') {
            const { data: currentAppointment, error: currentAppointmentError } = await supabase
                .from('appointments')
                .select('id, patient_id, professional_id')
                .eq('id', id)
                .maybeSingle();

            if (currentAppointmentError) throw currentAppointmentError;
            if (!currentAppointment) {
                throw new ApiRouteError(404, 'Appointment not found');
            }

            const appointmentAccess = currentAppointment as AppointmentAccessRow;
            if (appointmentAccess.professional_id !== userId) {
                throw new ApiRouteError(404, 'Appointment not found');
            }

            if (
                'professional_id' in cleanPayload &&
                cleanPayload.professional_id !== userId
            ) {
                throw new ApiRouteError(403, 'Forbidden');
            }

            if (
                'patient_id' in cleanPayload &&
                cleanPayload.patient_id !== appointmentAccess.patient_id
            ) {
                throw new ApiRouteError(403, 'Forbidden');
            }
        }

        let query = supabase
            .from('appointments')
            .update(cleanPayload)
            .eq('id', id);

        if (role === 'professional') {
            query = query.eq('professional_id', userId);
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
