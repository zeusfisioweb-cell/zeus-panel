import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, getAdminSupabase, handleApiError, normalizeNullableText, requirePanelAccess, writeAuditLog } from '../_lib';
const updateProfessionalSchema = z.object({
    id: z.string().uuid({ message: 'ID de profesional inválido' }),
    full_name: z.string().min(3).optional(),
    specialty: z.string().optional(),
    bio: z.string().optional(),
    color_code: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/, { message: 'Color inválido (ej: #3B82F6)' }).optional(),
    is_active: z.boolean().optional(),
    serviceIds: z.array(z.string()).max(100).optional(),
});

const deleteProfessionalSchema = z.object({
    id: z.string().uuid({ message: 'ID de profesional inválido' }),
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

        const { data: targetProfessional, error: targetProfessionalError } = await supabase
            .from('professionals')
            .select('id, user_id')
            .eq('id', id)
            .maybeSingle();

        if (targetProfessionalError) throw targetProfessionalError;
        if (!targetProfessional) {
            return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
        }

        if (professionalData.full_name !== undefined) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ full_name: professionalData.full_name })
                .eq('id', targetProfessional.user_id);

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
            const { error: replaceLinksError } = await supabase.rpc('replace_professional_service_links', {
                p_professional_id: id,
                p_service_ids: serviceIds,
            });
            if (replaceLinksError) throw replaceLinksError;
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

        const { data: professional, error: professionalLookupError } = await supabase
            .from('professionals')
            .select('id, user_id')
            .eq('id', id)
            .maybeSingle();

        if (professionalLookupError) throw professionalLookupError;
        if (!professional) {
            return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
        }

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

        let authBanError: string | null = null;
        try {
            const adminClient = getAdminSupabase();
            const { error } = await adminClient.auth.admin.updateUserById(
                professional.user_id,
                { ban_duration: '87600h' }
            );
            if (error) authBanError = error.message;
        } catch {
            authBanError = 'Admin client unavailable';
        }

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'professionals',
            recordId: id,
            details: {
                reassigned_appointments: count ?? 0,
                auth_banned: authBanError === null,
                auth_ban_error: authBanError,
            },
        });

        return NextResponse.json({
            success: true,
            reassignedAppointments: count ?? 0,
            ...(authBanError ? { warning: 'Auth account could not be banned' } : {}),
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
