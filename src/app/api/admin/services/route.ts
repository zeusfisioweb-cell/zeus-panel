import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceSchema, ServiceUpdateSchema } from '@/lib/schemas';
import { assertSameOriginMutation, getAdminSupabase, handleApiError, normalizeNullableText, requirePanelAccess, writeAuditLog } from '../_lib';
const updateServiceSchema = ServiceUpdateSchema.extend({
    id: z.string().uuid({ message: 'ID de servicio inválido' }),
});

const deleteServiceSchema = z.object({
    id: z.string().uuid({ message: 'ID de servicio inválido' }),
    force: z.boolean().optional(),
});

export async function GET() {
    try {
        const { supabase, role, userId } = await requirePanelAccess();

        if (role === 'professional') {
            const { data: professional, error: professionalError } = await supabase
                .from('professionals')
                .select('id, is_active')
                .eq('user_id', userId)
                .maybeSingle();

            if (professionalError) throw professionalError;
            if (!professional || !professional.is_active) {
                return NextResponse.json([]);
            }

            const { data: links, error: linksError } = await supabase
                .from('professional_services')
                .select(`
                    service:services (
                        *,
                        category:service_categories (
                            id,
                            name,
                            color
                        )
                    )
                `)
                .eq('professional_id', professional.id);

            if (linksError) throw linksError;

            const services = (links ?? [])
                .map((row) => {
                    const record = row as Record<string, unknown>;
                    return record.service as Record<string, unknown> | null | undefined;
                })
                .filter((service): service is Record<string, unknown> => Boolean(service))
                .filter((service) => Boolean(service.is_active))
                .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));

            return NextResponse.json(services);
        }

        const { data, error } = await supabase
            .from('services')
            .select(`
                *,
                category:service_categories (id, name, color),
                professional_services (professional_id)
            `)
            .order('name');

        if (error) throw error;

        return NextResponse.json(data ?? []);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const { professional_ids, ...serviceData } = rawBody as { professional_ids?: string[] } & Record<string, unknown>;
        const parsed = ServiceSchema.parse(serviceData);

        const payload = {
            ...parsed,
            description: normalizeNullableText(parsed.description),
        };

        const { data, error } = await supabase
            .from('services')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        if (Array.isArray(professional_ids) && professional_ids.length > 0) {
            const links = professional_ids.map((pid: string) => ({ service_id: data.id as string, professional_id: pid }));
            const { error: linkError } = await supabase.from('professional_services').insert(links);
            if (linkError) throw linkError;
        }

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'services',
            recordId: data.id as string,
            details: { name: data.name },
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const { professional_ids, ...rest } = rawBody as { professional_ids?: string[] } & Record<string, unknown>;
        const parsed = updateServiceSchema.parse(rest);
        const { id, ...updateData } = parsed;

        const payload = {
            ...updateData,
            description: updateData.description === undefined
                ? undefined
                : normalizeNullableText(updateData.description),
        };

        const { data, error } = await supabase
            .from('services')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (Array.isArray(professional_ids)) {
            const adminClient = getAdminSupabase();

            const { error: deleteLinksError } = await adminClient
                .from('professional_services')
                .delete()
                .eq('service_id', id);
            if (deleteLinksError) throw deleteLinksError;

            if (professional_ids.length > 0) {
                const linkRows = Array.from(new Set(professional_ids)).map((professional_id) => ({
                    professional_id,
                    service_id: id,
                }));
                const { error: insertLinksError } = await adminClient
                    .from('professional_services')
                    .insert(linkRows);
                if (insertLinksError) throw insertLinksError;
            }
        }

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'services',
            recordId: data.id as string,
            details: { name: data.name },
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const { id, force } = deleteServiceSchema.parse(rawBody);

        const nowIso = new Date().toISOString();
        const { count, error: countError } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('service_id', id)
            .in('status', ['pending', 'confirmed'])
            .gte('start_time', nowIso);

        if (countError) throw countError;

        if ((count ?? 0) > 0 && !force) {
            return NextResponse.json(
                {
                    error: `Hay ${count} cita(s) futuras con este servicio. Confirma para desvincularlas y eliminar.`,
                    count,
                    requiresConfirmation: true,
                },
                { status: 409 }
            );
        }

        if ((count ?? 0) > 0 && force) {
            const adminClient = getAdminSupabase();
            const { error: detachError } = await adminClient
                .from('appointments')
                .update({ service_id: null })
                .eq('service_id', id);
            if (detachError) throw detachError;
        }

        const { error: relationError } = await supabase
            .from('professional_services')
            .delete()
            .eq('service_id', id);

        if (relationError) throw relationError;

        const { error: deleteError } = await supabase
            .from('services')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'services',
            recordId: id,
            details: { detached_appointments: (count ?? 0) > 0 && force ? count : 0 },
        });

        return NextResponse.json({ success: true, detached: (count ?? 0) > 0 && force ? count : 0 });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
