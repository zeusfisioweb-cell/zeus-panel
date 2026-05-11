import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';

const deleteCategorySchema = z.object({ id: z.string().uuid() });
const createCategorySchema = z.object({
    name: z.string().min(2),
    is_active: z.boolean().default(true),
    display_order: z.coerce.number().int().min(0).default(0),
});

function toSlug(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export async function GET() {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const { data, error } = await supabase
            .from('service_categories')
            .select('*')
            .order('display_order');

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
        const parsed = createCategorySchema.parse(rawBody);

        const payload = {
            ...parsed,
            slug: toSlug(parsed.name),
        };

        const { data, error } = await supabase
            .from('service_categories')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'service_categories',
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
        const { id } = deleteCategorySchema.parse(rawBody);

        const { count, error: countError } = await supabase
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', id);

        if (countError) throw countError;

        if ((count ?? 0) > 0) {
            return NextResponse.json(
                { error: `No se puede eliminar: hay ${count} servicio(s) en esta categoría. Elimínalos primero.`, count },
                { status: 409 }
            );
        }

        const { error: deleteError } = await supabase
            .from('service_categories')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'service_categories',
            recordId: id,
            details: null,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
