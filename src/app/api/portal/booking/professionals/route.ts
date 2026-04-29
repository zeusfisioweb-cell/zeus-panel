import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';

interface RawProfessional {
    id: string;
    specialty: string | null;
    bio: string | null;
    color_code: string;
    is_active: boolean;
    profile: { full_name: string | null } | Array<{ full_name: string | null }> | null;
}

interface RawRow {
    professional: RawProfessional | RawProfessional[] | null;
}

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const service_id = url.searchParams.get('service_id');
        if (!service_id) return NextResponse.json({ error: 'service_id required' }, { status: 400 });

        const admin = getAdminSupabase();
        const { data, error } = await admin
            .from('professional_services')
            .select(`
                professional:professionals!inner(
                    id, specialty, bio, color_code, is_active,
                    profile:profiles(full_name)
                )
            `)
            .eq('service_id', service_id);

        if (error) throw error;

        const professionals = (data as unknown as RawRow[] ?? [])
            .map(row => {
                const p = Array.isArray(row.professional) ? row.professional[0] : row.professional;
                if (!p) return null;
                const profile = Array.isArray(p.profile) ? (p.profile[0] ?? null) : p.profile;
                return { ...p, profile };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null && p.is_active === true);

        return NextResponse.json({ professionals });
    } catch (error) {
        return handleApiError(error);
    }
}
