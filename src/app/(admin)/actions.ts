'use server';

import { createClient } from '@/lib/supabase/server';
import type {
    Appointment,
    DashboardData,
    DashboardGlobalStats,
    Professional,
    Service,
} from '@/lib/types';

export async function getDashboardData(
    dayStartIso: string,
    dayEndIso: string,
    weekStartIso: string,
    weekEndIso: string
): Promise<DashboardData> {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profile) throw new Error('Profile not found');

    const isOwner = profile.role === 'owner';
    let currentProfessionalId: string | null = null;

    if (profile.role === 'professional') {
        const { data: professional } = await supabase
            .from('professionals')
            .select('id, is_active')
            .eq('user_id', user.id)
            .maybeSingle();

        if (professional?.is_active) currentProfessionalId = professional.id;
    }

    if (!isOwner && !currentProfessionalId) {
        return {
            todayAppointments: [],
            stats: { todayCount: 0, weekCount: 0, totalPatients: 0 },
            globalStats: {
                estimatedRevenue: 0,
                totalGlobalAppointments: 0,
                sessionBreakdown: [],
                globalStatus: { confirmed: 0, completed: 0, cancelled: 0 },
            },
            services: [],
            professionals: [],
        };
    }

    // ── Today's appointments (full join for display) ───────────────────────────
    let todayQuery = supabase
        .from('appointments')
        .select('*, service:services(*), professional:professionals(*, profile:profiles(*))')
        .gte('start_time', dayStartIso)
        .lte('start_time', dayEndIso)
        .order('start_time', { ascending: true });

    if (!isOwner && currentProfessionalId) {
        todayQuery = todayQuery.eq('professional_id', currentProfessionalId);
    }

    // ── Week count ─────────────────────────────────────────────────────────────
    // head:true uses HTTP HEAD which doesn't reliably return count in server actions;
    // selecting only id is still lightweight and the count comes via Content-Range.
    let weekQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact' })
        .not('status', 'eq', 'cancelled')
        .gte('start_time', weekStartIso)
        .lte('start_time', weekEndIso);

    if (!isOwner && currentProfessionalId) {
        weekQuery = weekQuery.eq('professional_id', currentProfessionalId);
    }

    // ── All-time stats: status counts + session breakdown + revenue ────────────
    let globalQuery = supabase
        .from('appointments')
        .select('status, patient_id, service_id, end_time, service:services(name, price)');

    if (!isOwner && currentProfessionalId) {
        globalQuery = globalQuery.eq('professional_id', currentProfessionalId);
    }

    // ── Services + Professionals ───────────────────────────────────────────────
    const servicesPromise = isOwner
        ? supabase.from('services').select('*').eq('is_active', true).order('name')
        : supabase
            .from('professional_services')
            .select('service:services(*, category:service_categories(id, name, color))')
            .eq('professional_id', currentProfessionalId as string);

    const professionalsPromise = isOwner
        ? supabase.from('professionals').select('*, profile:profiles(*)').eq('is_active', true)
        : supabase
            .from('professionals')
            .select('*, profile:profiles(*)')
            .eq('id', currentProfessionalId as string)
            .eq('is_active', true);

    const [todayRes, weekRes, globalRes, servicesRes, profRes] = await Promise.all([
        todayQuery,
        weekQuery,
        globalQuery,
        servicesPromise,
        professionalsPromise,
    ]);

    // ── Compute global stats from raw rows ─────────────────────────────────────
    // Supabase returns joined relations as arrays even for to-one joins
    if (globalRes.error) {
        console.error('[getDashboardData] globalQuery failed:', globalRes.error.message);
    }
    type RawRow = { status: string; patient_id: string | null; service_id: string | null; end_time: string; service: unknown };
    const allRows = (globalRes.data ?? []) as RawRow[];
    const nowMs = Date.now();

    function isEffectivelyCompleted(row: RawRow): boolean {
        if (row.status === 'completed') return true;
        if (row.status === 'cancelled') return false;
        return new Date(row.end_time).getTime() < nowMs;
    }

    const globalStatus = { confirmed: 0, completed: 0, cancelled: 0 };
    const sessionCounts: Record<string, number> = {};
    let estimatedRevenue = 0;
    const patientIds = new Set<string>();

    for (const row of allRows) {
        if (row.status === 'cancelled') {
            globalStatus.cancelled++;
        } else if (isEffectivelyCompleted(row)) {
            globalStatus.completed++;
        } else {
            globalStatus.confirmed++;
        }
        if (row.patient_id) patientIds.add(row.patient_id);

        if (isEffectivelyCompleted(row)) {
            // Supabase may return the join as object or single-element array
            const svcRaw = Array.isArray(row.service) ? row.service[0] : row.service;
            const svc = svcRaw as { name: string; price: number } | null;
            if (svc?.name) {
                sessionCounts[svc.name] = (sessionCounts[svc.name] ?? 0) + 1;
                estimatedRevenue += svc.price ?? 0;
            }
        }
    }

    const sessionBreakdown = Object.entries(sessionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));

    const totalGlobalAppointments =
        globalStatus.confirmed + globalStatus.completed + globalStatus.cancelled;

    const globalStats: DashboardGlobalStats = {
        estimatedRevenue,
        totalGlobalAppointments,
        sessionBreakdown,
        globalStatus,
    };

    const services = isOwner
        ? ((servicesRes.data as Service[]) || [])
        : ((servicesRes.data || [])
            .map((row) => (row as Record<string, unknown>).service as Service | null | undefined)
            .filter((s): s is Service => s != null && s.is_active === true));

    return {
        todayAppointments: (todayRes.data as Appointment[]) || [],
        stats: {
            todayCount: (todayRes.data || []).filter((a: Appointment) => a.status !== 'cancelled').length,
            weekCount: weekRes.count ?? 0,
            totalPatients: patientIds.size,
        },
        globalStats,
        services,
        professionals: (profRes.data as Professional[]) || [],
    };
}
