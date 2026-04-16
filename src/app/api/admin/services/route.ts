import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceSchema, ServiceUpdateSchema } from '@/lib/schemas';
import { handleApiError, normalizeNullableText, requirePanelAccess } from '../_lib';

const updateServiceSchema = ServiceUpdateSchema.extend({
    id: z.string().min(1),
});

const deleteServiceSchema = z.object({
    id: z.string().min(1),
});

export async function GET() {
    try {
        const { supabase, role } = await requirePanelAccess();
        let query = supabase
            .from('services')
            .select(`
                *,
                category:service_categories (
                    id,
                    name,
                    color
                )
            `)
            .order('name');

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

export async function POST(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const parsed = ServiceSchema.parse(rawBody);

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

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const parsed = updateServiceSchema.parse(rawBody);
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

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const rawBody = await request.json();
        const { id } = deleteServiceSchema.parse(rawBody);

        const nowIso = new Date().toISOString();
        const { count, error: countError } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('service_id', id)
            .in('status', ['pending', 'confirmed'])
            .gte('start_time', nowIso);

        if (countError) throw countError;

        if ((count ?? 0) > 0) {
            return NextResponse.json(
                {
                    error: `No se puede eliminar: hay ${count} cita(s) futuras con este servicio. Desactivalo en su lugar.`,
                    count,
                },
                { status: 409 }
            );
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

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
