import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, normalizeNullableText, requirePanelAccess } from '../_lib';

const updateProfessionalSchema = z.object({
    id: z.string().min(1),
    full_name: z.string().min(3).optional(),
    specialty: z.string().optional(),
    bio: z.string().optional(),
    color_code: z.string().optional(),
    is_active: z.boolean().optional(),
    serviceIds: z.array(z.string()).optional(),
});

const deleteProfessionalSchema = z.object({
    id: z.string().min(1),
});

export async function GET() {
    try {
        const { supabase, role } = await requirePanelAccess();

        const ownerSelect = `
                id,
                specialty,
                license_number,
                bio,
                color_code,
                is_active,
                created_at,
                profile:profiles (
                    id,
                    email,
                    role,
                    full_name,
                    created_at
                ),
                professional_services(service_id)
            `;

        const professionalSelect = `
                id,
                specialty,
                license_number,
                bio,
                color_code,
                is_active,
                created_at,
                profile:profiles (
                    id,
                    email,
                    role,
                    full_name,
                    created_at
                )
            `;

        let query = supabase
            .from('professionals')
            .select(role === 'owner' ? ownerSelect : professionalSelect);

        if (role === 'professional') {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json(data ?? []);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const parsed = updateProfessionalSchema.parse(rawBody);
        const { id, serviceIds, ...professionalData } = parsed;

        if (professionalData.full_name) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ full_name: professionalData.full_name })
                .eq('id', id);

            if (profileError) throw profileError;
        }

        const professionalPayload: Record<string, string | boolean | null> = {};
        if (professionalData.specialty !== undefined) professionalPayload.specialty = normalizeNullableText(professionalData.specialty);
        if (professionalData.bio !== undefined) professionalPayload.bio = normalizeNullableText(professionalData.bio);
        if (professionalData.color_code !== undefined) professionalPayload.color_code = professionalData.color_code;
        if (professionalData.is_active !== undefined) professionalPayload.is_active = professionalData.is_active;

        if (Object.keys(professionalPayload).length > 0) {
            const { error: professionalError } = await supabase
                .from('professionals')
                .update(professionalPayload)
                .eq('id', id);

            if (professionalError) throw professionalError;
        }

        if (serviceIds !== undefined) {
            const { error: deleteServiceLinksError } = await supabase
                .from('professional_services')
                .delete()
                .eq('professional_id', id);

            if (deleteServiceLinksError) throw deleteServiceLinksError;

            if (serviceIds.length > 0) {
                const rows = serviceIds.map((serviceId) => ({
                    professional_id: id,
                    service_id: serviceId,
                }));

                const { error: insertServiceLinksError } = await supabase
                    .from('professional_services')
                    .insert(rows);

                if (insertServiceLinksError) throw insertServiceLinksError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const { id } = deleteProfessionalSchema.parse(rawBody);
        const nowIso = new Date().toISOString();

        const { count, error: countError } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', id)
            .in('status', ['pending', 'confirmed'])
            .gte('start_time', nowIso);

        if (countError) throw countError;

        if ((count ?? 0) > 0) {
            const { error: updateAppointmentsError } = await supabase
                .from('appointments')
                .update({ professional_id: null })
                .eq('professional_id', id)
                .in('status', ['pending', 'confirmed'])
                .gte('start_time', nowIso);

            if (updateAppointmentsError) throw updateAppointmentsError;
        }

        const { error: deleteSlotsError } = await supabase
            .from('schedule_slots')
            .delete()
            .eq('professional_id', id);

        if (deleteSlotsError) throw deleteSlotsError;

        const { error: disableProfessionalError } = await supabase
            .from('professionals')
            .update({ is_active: false })
            .eq('id', id);

        if (disableProfessionalError) throw disableProfessionalError;

        return NextResponse.json({
            success: true,
            reassignedAppointments: count ?? 0,
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
