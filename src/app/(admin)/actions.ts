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
    dayStartIso: string,
    dayEndIso: string,
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
        .maybeSingle();

    if (profileError || !profile) {
        throw new Error('Profile not found');
    }

    const isOwner = profile.role === 'owner';
    let currentProfessionalId: string | null = null;

    if (profile.role === 'professional') {
        const { data: professional, error: professionalError } = await supabase
            .from('professionals')
            .select('id, is_active')
            .eq('user_id', user.id)
            .maybeSingle();

        if (professionalError) {
            throw professionalError;
        }

        if (professional?.is_active) {
            currentProfessionalId = professional.id;
        }
    }

    if (!isOwner && !currentProfessionalId) {
        return {
            todayAppointments: [],
            stats: {
                todayCount: 0,
                weekCount: 0,
                totalPatients: 0,
                pendingCount: 0,
            },
            globalStats: {
                estimatedRevenue: 0,
                totalGlobalAppointments: 0,
                sessionBreakdown: [],
                globalStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
            },
            services: [],
            professionals: [],
        };
    }

    let appointmentsQuery = supabase
        .from('appointments')
        .select('*, service:services(*), professional:professionals(*, profile:profiles(*))')
        .gte('start_time', dayStartIso)
        .lte('start_time', dayEndIso)
        .order('start_time', { ascending: true });

    if (!isOwner && currentProfessionalId) {
        appointmentsQuery = appointmentsQuery.eq('professional_id', currentProfessionalId);
    }

    const servicesPromise = isOwner
        ? supabase.from('services').select('*').eq('is_active', true).order('name')
        : supabase
            .from('professional_services')
            .select('service:services(*, category:service_categories(id, name, color))')
            .eq('professional_id', currentProfessionalId as string);

    const professionalsPromise = isOwner
        ? supabase
            .from('professionals')
            .select('*, profile:profiles(*)')
            .eq('is_active', true)
        : supabase
            .from('professionals')
            .select('*, profile:profiles(*)')
            .eq('id', currentProfessionalId as string)
            .eq('is_active', true);

    const [appointmentsRes, servicesRes, profRes, statsRes] = await Promise.all([
        appointmentsQuery,
        servicesPromise,
        professionalsPromise,
        supabase.rpc('get_dashboard_stats', {
            p_professional_id: isOwner ? null : currentProfessionalId,
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

    const services = isOwner
        ? ((servicesRes.data as Service[]) || [])
        : ((servicesRes.data || [])
            .map((row) => (row as Record<string, unknown>).service as Service | null | undefined)
            .filter((service): service is Service => service != null && service.is_active === true));

    return {
        todayAppointments: (appointmentsRes.data as Appointment[]) || [],
        stats: {
            todayCount: (appointmentsRes.data || []).filter((a: Appointment) => a.status !== 'cancelled').length,
            weekCount: statsData.weekCount || 0,
            totalPatients: statsData.totalPatients || 0,
            pendingCount: statsData.pendingCount || 0,
        },
        globalStats,
        services,
        professionals: (profRes.data as Professional[]) || [],
    };
}
