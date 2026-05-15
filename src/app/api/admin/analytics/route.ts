import { NextResponse } from 'next/server';
import { handleApiError, requirePanelAccess, selectAllRows } from '../_lib';

interface AnalyticsApt {
    patient_id: string | null;
    professional_id: string | null;
    service_id: string | null;
    status: string;
    source: string | null;
    start_time: string;
    end_time: string;
    service: { name: string; price: number; duration_minutes: number } | null;
}

const CLINIC_TZ = 'Europe/Madrid';

function tzHour(isoString: string): number {
    const d = new Date(isoString);
    return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: CLINIC_TZ, hour: 'numeric', hour12: false }).format(d), 10);
}

function tzDayOfWeek(isoString: string): number {
    const d = new Date(isoString);
    // Sunday=0 … Saturday=6, same as getDay()
    const local = new Date(d.toLocaleString('en-US', { timeZone: CLINIC_TZ }));
    return local.getDay();
}

export async function GET(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const url = new URL(request.url);
        const period = url.searchParams.get('period') || 'last_30_days';
        const startParam = url.searchParams.get('start');
        const endParam = url.searchParams.get('end');

        // ── Fechas del mes actual para el reporte ──
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // ── Week boundaries (for occupancy) ──
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        weekStart.setHours(0, 0, 0, 0);

        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (startParam && endParam) {
            startDate = new Date(startParam);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(endParam);
            endDate.setHours(23, 59, 59, 999);
        } else {
            if (period === 'last_7_days') {
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
            } else if (period === 'last_30_days') {
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 30);
            } else if (period === 'last_year') {
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
            } // all_time leaves startDate null
        }

        // ── DB-level lower bound: earliest of period start, 6-month trend window, month start, week start ──
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
        const dbLowerBound = [startDate, sixMonthsAgo, startOfMonth, weekStart]
            .filter((d): d is Date => d !== null)
            .reduce((earliest, d) => d < earliest ? d : earliest);

        // ── Fetch appointments with DB-level filter (covers period + occupancy windows) ──
        const allApts = await selectAllRows<AnalyticsApt>((from, to) =>
            supabase
                .from('appointments')
                .select('patient_id, professional_id, service_id, status, source, start_time, end_time, service:services(name, price, duration_minutes)')
                .gte('start_time', dbLowerBound.toISOString())
                .order('start_time', { ascending: true })
                .range(from, to)
        );

        const periodApts = (allApts ?? []).filter(a => {
            const start = new Date(a.start_time);
            if (startDate && start < startDate) return false;
            if (endDate && start > endDate) return false;
            return true;
        });

        const completedPeriodApts = periodApts.filter(a => a.status === 'completed');

        // ═══════════════════════════════════════════════════════════
        // 1. ADHERENCIA — visitas completadas por paciente
        // ═══════════════════════════════════════════════════════════
        const visitsByPatient: Record<string, number> = {};
        for (const a of completedPeriodApts) {
            if (a.patient_id) visitsByPatient[a.patient_id] = (visitsByPatient[a.patient_id] || 0) + 1;
        }
        const counts = Object.values(visitsByPatient);
        const totalPatients = counts.length;
        const averageVisits = totalPatients > 0
            ? Number((counts.reduce((s, c) => s + c, 0) / totalPatients).toFixed(1)) : 0;
        const oneTime  = counts.filter(c => c === 1).length;
        const twoThree = counts.filter(c => c === 2 || c === 3).length;
        const loyal    = counts.filter(c => c >= 4).length;

        // ═══════════════════════════════════════════════════════════
        // 2. INGRESOS ESTIMADOS por servicio
        // ═══════════════════════════════════════════════════════════
        const revenueByService: Record<string, { name: string; revenue: number; sessions: number }> = {};
        for (const a of completedPeriodApts) {
            const svc = a.service as unknown as { name: string; price: number } | null;
            if (!svc || !a.service_id) continue;
            if (!revenueByService[a.service_id]) {
                revenueByService[a.service_id] = { name: svc.name, revenue: 0, sessions: 0 };
            }
            revenueByService[a.service_id].revenue += svc.price ?? 0;
            revenueByService[a.service_id].sessions++;
        }
        const topServices = Object.values(revenueByService)
            .sort((a, b) => b.revenue - a.revenue).slice(0, 8);
        const totalEstimatedRevenue = Object.values(revenueByService)
            .reduce((s, v) => s + v.revenue, 0);

        // ═══════════════════════════════════════════════════════════
        // 3. SESIONES POR PROFESIONAL
        // ═══════════════════════════════════════════════════════════
        const { data: profData } = await supabase
            .from('professionals')
            .select('id, profile:profiles(full_name)')
            .eq('is_active', true);

        const sessionsByPro: Record<string, { name: string; sessions: number }> = {};
        for (const p of profData ?? []) {
            const profile = p.profile as unknown as { full_name: string | null } | null;
            sessionsByPro[p.id] = { name: profile?.full_name ?? 'Profesional', sessions: 0 };
        }
        for (const a of completedPeriodApts) {
            if (a.professional_id && sessionsByPro[a.professional_id]) {
                sessionsByPro[a.professional_id].sessions++;
            }
        }
        const sessionsByProList = Object.values(sessionsByPro)
            .sort((a, b) => b.sessions - a.sessions);

        // ═══════════════════════════════════════════════════════════
        // 4. DISTRIBUCIÓN POR DÍA DE SEMANA
        // ═══════════════════════════════════════════════════════════
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dayColors = ['#64748B', '#2563EB', '#0F766E', '#7C3AED', '#059669', '#AD7332', '#D97706'];
        const dayCount = [0, 0, 0, 0, 0, 0, 0];
        for (const a of completedPeriodApts) {
            dayCount[tzDayOfWeek(a.start_time)]++;
        }
        const dayBreakdown = dayNames.map((name, i) => ({ name, shortName: name, value: dayCount[i], color: dayColors[i] }));

        // ═══════════════════════════════════════════════════════════
        // 5. ESTADO GLOBAL + tasa de cancelación (mes actual)
        // ═══════════════════════════════════════════════════════════
        const statusCount: Record<string, number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
        for (const a of periodApts) {
            if (a.status in statusCount) statusCount[a.status]++;
        }
        const totalAll = Object.values(statusCount).reduce((s, v) => s + v, 0);
        const cancellationRate = totalAll > 0 ? Math.round((statusCount.cancelled / totalAll) * 100) : 0;

        // ═══════════════════════════════════════════════════════════
        // 6. OCUPACIÓN SEMANAL Y MENSUAL
        // ═══════════════════════════════════════════════════════════
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        let weeklyBookedMinutes = 0;
        let monthlyBookedMinutes = 0;
        
        for (const a of allApts ?? []) {
            if (a.status === 'cancelled') continue;
            const start = new Date(a.start_time);
            const duration = (new Date(a.end_time).getTime() - start.getTime()) / 60000;
            
            // Mes actual
            if (start >= startOfMonth && start <= endOfMonth) {
                monthlyBookedMinutes += duration;
            }
            // Semana actual
            if (start >= weekStart && start <= weekEnd) {
                weeklyBookedMinutes += duration;
            }
        }

        const { count: prosCount } = await supabase
            .from('professionals')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true);

        const activeProIds = (profData ?? []).map((p) => p.id as string);
        const { data: slotsData } = await supabase
            .from('schedule_slots')
            .select('start_time, end_time')
            .in('professional_id', activeProIds);

        const realWeeklyMinutes = (slotsData ?? []).reduce((sum, slot) => {
            const [sh, sm] = slot.start_time.split(':').map(Number);
            const [eh, em] = slot.end_time.split(':').map(Number);
            return sum + (eh * 60 + em) - (sh * 60 + sm);
        }, 0);
        const weeklyCapacityMinutes = realWeeklyMinutes || (prosCount || 1) * 35 * 60;

        // Mensual
        const capacityMinutesMonthly = weeklyCapacityMinutes * 4.33;
        const monthlyHoursBooked = Number((monthlyBookedMinutes / 60).toFixed(1));
        const capacityHoursMonthly = Number((capacityMinutesMonthly / 60).toFixed(1));
        const occupancyRateMonthly = capacityHoursMonthly > 0
            ? Math.min(100, Math.round((monthlyHoursBooked / capacityHoursMonthly) * 100)) : 0;

        // Custom Range Ocupación (if start and end provided)
        let customBookedMinutes = 0;
        let occupancyRateCustom = 0;
        let customHoursBooked = 0;
        let capacityHoursCustom = 0;

        if (startDate && endDate) {
            for (const a of periodApts) {
                if (a.status === 'cancelled') continue;
                const start = new Date(a.start_time);
                const duration = (new Date(a.end_time).getTime() - start.getTime()) / 60000;
                customBookedMinutes += duration;
            }
            const daysInSpan = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
            const capacityMinutesCustom = weeklyCapacityMinutes * (daysInSpan / 7);
            
            customHoursBooked = Number((customBookedMinutes / 60).toFixed(1));
            capacityHoursCustom = Number((capacityMinutesCustom / 60).toFixed(1));
            occupancyRateCustom = capacityHoursCustom > 0
                ? Math.min(100, Math.round((customHoursBooked / capacityHoursCustom) * 100)) : 0;
        }

        // Semanal
        const capacityMinutesWeekly = weeklyCapacityMinutes;
        const weeklyHoursBooked = Number((weeklyBookedMinutes / 60).toFixed(1));
        const capacityHoursWeekly = Number((capacityMinutesWeekly / 60).toFixed(1));
        const occupancyRateWeekly = capacityHoursWeekly > 0
            ? Math.min(100, Math.round((weeklyHoursBooked / capacityHoursWeekly) * 100)) : 0;

        // ═══════════════════════════════════════════════════════════
        // 7. TENDENCIA MENSUAL DE INGRESOS (últimos 6 meses)
        // ═══════════════════════════════════════════════════════════
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthlyData: Record<string, { revenue: number; sessions: number }> = {};

        // Build 6 month buckets
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[key] = { revenue: 0, sessions: 0 };
        }

        // Usamos todo el histórico para la tendencia de 6 meses
        const allCompletedAptsForTrend = (allApts ?? []).filter(a => a.status === 'completed');
        for (const a of allCompletedAptsForTrend) {
            const d = new Date(a.start_time);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (key in monthlyData) {
                const svc = a.service as unknown as { price: number } | null;
                monthlyData[key].revenue += svc?.price ?? 0;
                monthlyData[key].sessions++;
            }
        }

        const revenueTrend = Object.entries(monthlyData).map(([key, v]) => {
            const [, month] = key.split('-');
            return {
                label: monthNames[parseInt(month, 10) - 1],
                revenue: Math.round(v.revenue),
                sessions: v.sessions,
            };
        });

        // ═══════════════════════════════════════════════════════════
        // 8. ORIGEN DE RESERVAS
        // ═══════════════════════════════════════════════════════════
        const sourceCount: Record<string, number> = { web: 0, admin: 0, phone: 0 };
        for (const a of periodApts) {
            const src = (a.source as string) || 'admin';
            if (src in sourceCount) sourceCount[src]++;
        }

        // ═══════════════════════════════════════════════════════════
        // 9. HORAS PICO — distribución por hora del día (8h-20h)
        // ═══════════════════════════════════════════════════════════
        const hourBuckets: Record<number, number> = {};
        for (let h = 8; h <= 20; h++) hourBuckets[h] = 0;
        for (const a of completedPeriodApts) {
            const hour = tzHour(a.start_time);
            if (hour >= 8 && hour <= 20) hourBuckets[hour]++;
        }
        const peakHours = Object.entries(hourBuckets).map(([h, count]) => ({
            name: `${h}:00`,
            shortName: `${h}h`,
            value: count,
            color: count === Math.max(...Object.values(hourBuckets)) ? '#AD7332' : '#C9954D',
        }));

        return NextResponse.json({
            adherence: { averageVisits, oneTime, twoThree, loyal, totalPatients },
            revenue: { topServices, totalEstimatedRevenue },
            professionals: sessionsByProList,
            dayBreakdown,
            statusBreakdown: { statusCount, cancellationRate, totalAll },
            occupancy: {
                custom: { rate: occupancyRateCustom, hoursBooked: customHoursBooked, capacityHours: capacityHoursCustom },
                monthly: { rate: occupancyRateMonthly, hoursBooked: monthlyHoursBooked, capacityHours: capacityHoursMonthly },
                weekly: { rate: occupancyRateWeekly, hoursBooked: weeklyHoursBooked, capacityHours: capacityHoursWeekly },
            },
            // New complex metrics:
            revenueTrend,
            bookingSources: {
                web: sourceCount.web,
                admin: sourceCount.admin,
                phone: sourceCount.phone,
                total: periodApts.length,
            },
            peakHours,
        });
    } catch (err) {
        return handleApiError(err);
    }
}
