'use server';

import { createClient } from '@/lib/supabase/server';
import type { Appointment, Service, Professional } from '@/lib/types';

export async function getDashboardData(
    todayStr: string,
    endStr: string,
    weekStartIso: string,
    weekEndIso: string,
    profileId: string | undefined,
    profileRole: string | undefined
) {
    const supabase = await createClient();

    const isOwner = profileRole === 'owner';
    const userProfId = profileRole === 'professional' ? profileId : null;

    let appointmentsQuery = supabase
        .from('appointments')
        .select('*, service:services(*), professional:professionals(*, profile:profiles(*))')
        .gte('start_time', `${todayStr}T00:00:00`)
        .lte('start_time', `${endStr}T23:59:59`)
        .order('start_time', { ascending: true });

    let weekQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact' })
        .gte('start_time', weekStartIso)
        .lte('start_time', weekEndIso)
        .neq('status', 'cancelled');

    let pendingQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');

    if (!isOwner && userProfId) {
        appointmentsQuery = appointmentsQuery.eq('professional_id', userProfId);
        weekQuery = weekQuery.eq('professional_id', userProfId);
        pendingQuery = pendingQuery.eq('professional_id', userProfId);
    }

    const [appointmentsRes, weekRes, patientsRes, pendingRes, servicesRes, profRes] =
        await Promise.all([
            appointmentsQuery,
            weekQuery,
            supabase.from('patients').select('id', { count: 'exact' }),
            pendingQuery,
            supabase.from('services').select('*').eq('is_active', true).order('name'),
            supabase
                .from('professionals')
                .select('*, profile:profiles(*)')
                .eq('is_active', true),
        ]);

    return {
        todayAppointments: (appointmentsRes.data as Appointment[]) || [],
        stats: {
            todayCount: (appointmentsRes.data || []).filter((a: Appointment) => a.status !== 'cancelled').length,
            weekCount: weekRes.count || 0,
            totalPatients: patientsRes.count || 0,
            pendingCount: pendingRes.count || 0,
        },
        services: (servicesRes.data as Service[]) || [],
        professionals: (profRes.data as Professional[]) || [],
    };
}
