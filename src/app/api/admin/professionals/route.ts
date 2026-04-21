import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, normalizeNullableText, requirePanelAccess, writeAuditLog } from '../_lib';

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
        const { supabase, role, userId } = await requirePanelAccess();

        const ownerSelect = `
                id,
                user_id,
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
                user_id,
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

        if (role === 'owner') {
            const { data, error } = await supabase
                .from('professionals')
                .select(ownerSelect);

            if (error) throw error;

            const filtered = (data ?? []).filter((row) => {
                const record = row as Record<string, unknown>;
                const profileRaw = record.profile as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
                const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
                return profile?.role === 'professional';
            });

            return NextResponse.json(filtered);
        }

        const { data, error } = await supabase
            .from('professionals')
            .select(professionalSelect)
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) throw error;

        const filtered = (data ?? []).filter((row) => {
            const record = row as Record<string, unknown>;
            const profileRaw = record.profile as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
            const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
            return profile?.role === 'professional';
        });

        return NextResponse.json(filtered);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
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

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'professionals',
            recordId: id,
            details: {
                service_links_updated: serviceIds !== undefined,
                is_active: professionalData.is_active ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
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

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'professionals',
            recordId: id,
            details: { reassigned_appointments: count ?? 0 },
        });

        return NextResponse.json({
            success: true,
            reassignedAppointments: count ?? 0,
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
