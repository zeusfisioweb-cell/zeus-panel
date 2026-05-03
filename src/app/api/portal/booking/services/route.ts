import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const category_id = url.searchParams.get('category_id');
        if (!category_id) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

        const admin = getAdminSupabase();
        const { data, error } = await admin
            .from('services')
            .select(`
                id, name, description, duration_minutes, price,
                professional_services(
                    professional:professionals(id, is_active)
                )
            `)
            .eq('category_id', category_id)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        const services = (data ?? []).filter((service) =>
            (service.professional_services ?? []).some((link) => {
                const professional = Array.isArray(link.professional) ? link.professional[0] : link.professional;
                return professional?.is_active === true;
            })
        ).map((service) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            duration_minutes: service.duration_minutes,
            price: service.price,
        }));

        return NextResponse.json({ services });
    } catch (error) {
        return handleApiError(error);
    }
}
