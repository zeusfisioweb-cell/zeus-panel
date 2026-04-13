'use server';

import { createClient } from '@/lib/supabase/server';
import type {
    Appointment,
    DashboardData,
    DashboardGlobalStats,
    DashboardGlobalStatus,
    DashboardSessionBreakdownItem,
    Professional,
    Service,
} from '@/lib/types';

interface DashboardRpcStats {
    totalPatients: number;
    weekCount: number;
    pendingCount: number;
    totalGlobalAppointments: number;
    estimatedRevenue: number;
    sessionBreakdown: DashboardSessionBreakdownItem[];
    globalStatus: DashboardGlobalStatus;
}

export async function getDashboardData(
    todayStr: string,
    endStr: string,
    weekStartIso: string,
    weekEndIso: string
): Promise<DashboardData> {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        throw new Error('Unauthorized');
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        throw new Error('Profile not found');
    }

    const isOwner = profile.role === 'owner';
    const userProfId = profile.role === 'professional' ? profile.id : null;

    let appointmentsQuery = supabase
        .from('appointments')
        .select('*, service:services(*), professional:professionals(*, profile:profiles(*))')
        .gte('start_time', `${todayStr}T00:00:00`)
        .lte('start_time', `${endStr}T23:59:59`)
        .order('start_time', { ascending: true });

    if (!isOwner && userProfId) {
        appointmentsQuery = appointmentsQuery.eq('professional_id', userProfId);
    }

    const [appointmentsRes, servicesRes, profRes, statsRes] = await Promise.all([
        appointmentsQuery,
        supabase.from('services').select('*').eq('is_active', true).order('name'),
        supabase
            .from('professionals')
            .select('*, profile:profiles(*)')
            .eq('is_active', true),
        supabase.rpc('get_dashboard_stats', {
            p_professional_id: isOwner ? null : userProfId,
            p_week_start: weekStartIso,
            p_week_end: weekEndIso
        })
    ]);

    const statsData: DashboardRpcStats = (statsRes.data as DashboardRpcStats | null) || {
        totalPatients: 0,
        weekCount: 0,
        pendingCount: 0,
        globalStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
        totalGlobalAppointments: 0,
        estimatedRevenue: 0,
        sessionBreakdown: [],
    };

    const globalStats: DashboardGlobalStats = {
        estimatedRevenue: statsData.estimatedRevenue || 0,
        totalGlobalAppointments: statsData.totalGlobalAppointments || 0,
        sessionBreakdown: statsData.sessionBreakdown || [],
        globalStatus: statsData.globalStatus || { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
    };

    return {
        todayAppointments: (appointmentsRes.data as Appointment[]) || [],
        stats: {
            todayCount: (appointmentsRes.data || []).filter((a: Appointment) => a.status !== 'cancelled').length,
            weekCount: statsData.weekCount || 0,
            totalPatients: statsData.totalPatients || 0,
            pendingCount: statsData.pendingCount || 0,
        },
        globalStats,
        services: (servicesRes.data as Service[]) || [],
        professionals: (profRes.data as Professional[]) || [],
    };
}
