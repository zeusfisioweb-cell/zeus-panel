'use server';

import { createClient } from '@/lib/supabase/server';

export interface ChurnRiskPatient {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    last_visit_date: string;
    total_visits: number;
}

export interface AnalyticsData {
    adherence: {
        averageVisits: number;
        oneTimePatients: number;
        loyalPatients: number; // > 3 visits
    };
    occupancy: {
        rate: number;
        weeklyHoursBooked: number;
        estimatedCapacity: number;
    };
    churnRisk: ChurnRiskPatient[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
    const supabase = await createClient();
    
    // 1. Adherence: Average visits per patient
    // Count all completed appointments grouped by patient
    const { data: apts, error: aptError } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('status', 'completed')
        .not('patient_id', 'is', null);

    if (aptError) throw aptError;

    const patientCounts: Record<string, number> = {};
    for (const a of apts || []) {
        if (a.patient_id) {
            patientCounts[a.patient_id] = (patientCounts[a.patient_id] || 0) + 1;
        }
    }

    const patientIds = Object.keys(patientCounts);
    let totalVisits = 0;
    let oneTimePatients = 0;
    let loyalPatients = 0;

    for (const id of patientIds) {
        const count = patientCounts[id];
        totalVisits += count;
        if (count === 1) oneTimePatients++;
        if (count >= 3) loyalPatients++;
    }

    const averageVisits = patientIds.length > 0 ? Number((totalVisits / patientIds.length).toFixed(1)) : 0;

    // 2. Churn Risk: 1 or 2 visits, last one > 15 days ago, no future appts
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysIso = fifteenDaysAgo.toISOString();

    const now = new Date().toISOString();

    // Patients with upcoming appointments
    const { data: upcomingApts } = await supabase
        .from('appointments')
        .select('patient_id')
        .in('status', ['pending', 'confirmed'])
        .gte('start_time', now)
        .not('patient_id', 'is', null);

    const safePatientIds = new Set((upcomingApts || []).map(a => a.patient_id));

    // Find churn risk patient IDs
    const churnRiskIds: string[] = [];
    for (const id of patientIds) {
        const count = patientCounts[id];
        if (count >= 1 && count <= 2 && !safePatientIds.has(id)) {
            churnRiskIds.push(id);
        }
    }

    let churnRiskList: ChurnRiskPatient[] = [];
    
    if (churnRiskIds.length > 0) {
        // We only want those whose LAST visit was > 15 days ago
        // Need to query their latest completed appointment
        const { data: latestApts } = await supabase
            .from('appointments')
            .select('patient_id, start_time, patient:patients(id, first_name, last_name, phone, email)')
            .eq('status', 'completed')
            .in('patient_id', churnRiskIds)
            .order('start_time', { ascending: false });
            
        // Group by patient to find the max date
        const latestDateByPatient: Record<string, {
            patient_id: string;
            start_time: string;
            patient: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; } | null;
        }> = {};
        for (const apt of latestApts || []) {
            if (!latestDateByPatient[apt.patient_id]) {
                const patient = Array.isArray(apt.patient) ? (apt.patient[0] ?? null) : apt.patient;
                latestDateByPatient[apt.patient_id] = { ...apt, patient };
            }
        }
        
        for (const id of churnRiskIds) {
            const latestApt = latestDateByPatient[id];
            if (latestApt && latestApt.start_time < fifteenDaysIso && latestApt.patient) {
                churnRiskList.push({
                    id: latestApt.patient.id,
                    first_name: latestApt.patient.first_name,
                    last_name: latestApt.patient.last_name,
                    phone: latestApt.patient.phone,
                    email: latestApt.patient.email,
                    last_visit_date: latestApt.start_time,
                    total_visits: patientCounts[id],
                });
            }
        }
    }

    // Sort churn risk by longest time since last visit
    churnRiskList.sort((a, b) => new Date(a.last_visit_date).getTime() - new Date(b.last_visit_date).getTime());
    
    // Limit to top 20 to avoid massive lists
    churnRiskList = churnRiskList.slice(0, 20);

    // 3. Occupancy: Simple weekly heuristic
    const weekStart = new Date();
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23,59,59,999);

    const { data: weekApts } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .not('status', 'eq', 'cancelled')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString());

    let bookedMinutes = 0;
    for (const a of weekApts || []) {
        const start = new Date(a.start_time).getTime();
        const end = new Date(a.end_time).getTime();
        bookedMinutes += (end - start) / 60000;
    }

    const { count: activeProsCount } = await supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

    const estimatedWeeklyCapacityMinutes = (activeProsCount || 1) * 35 * 60; // Assume 35h per pro
    const weeklyHoursBooked = Number((bookedMinutes / 60).toFixed(1));
    const estimatedCapacityHours = estimatedWeeklyCapacityMinutes / 60;
    const occupancyRate = estimatedCapacityHours > 0 ? Math.round((weeklyHoursBooked / estimatedCapacityHours) * 100) : 0;

    return {
        adherence: {
            averageVisits,
            oneTimePatients,
            loyalPatients,
        },
        occupancy: {
            rate: Math.min(occupancyRate, 100),
            weeklyHoursBooked,
            estimatedCapacity: estimatedCapacityHours,
        },
        churnRisk: churnRiskList,
    };
}
