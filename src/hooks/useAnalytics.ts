'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface AnalyticsResponse {
    adherence: {
        averageVisits: number;
        oneTime: number;
        twoThree: number;
        loyal: number;
        totalPatients: number;
    };
    revenue: {
        topServices: Array<{ name: string; revenue: number; sessions: number }>;
        totalEstimatedRevenue: number;
    };
    professionals: Array<{ name: string; sessions: number }>;
    dayBreakdown: Array<{ name: string; shortName: string; value: number; color: string }>;
    statusBreakdown: {
        statusCount: Record<string, number>;
        cancellationRate: number;
        totalAll: number;
    };
    occupancy: {
        custom: { rate: number; hoursBooked: number; capacityHours: number };
        monthly: { rate: number; hoursBooked: number; capacityHours: number };
        weekly: { rate: number; hoursBooked: number; capacityHours: number };
    };
    revenueTrend: Array<{ label: string; revenue: number; sessions: number }>;
    bookingSources: {
        web: number;
        admin: number;
        phone: number;
        total: number;
    };
    peakHours: Array<{ name: string; shortName: string; value: number; color: string }>;
}

export type AnalyticsPeriod = 'last_7_days' | 'last_30_days' | 'last_year' | 'all_time' | 'custom';

export function useAnalytics(period: AnalyticsPeriod = 'last_30_days', start?: string, end?: string) {
    return useQuery<AnalyticsResponse>({
        queryKey: ['admin_analytics', period, start, end],
        queryFn: () => {
            const url =
                period === 'custom' && start && end
                    ? `/api/admin/analytics?period=custom&start=${start}&end=${end}`
                    : `/api/admin/analytics?period=${period}`;
            return apiFetch<AnalyticsResponse>(url);
        },
        staleTime: 5 * 60 * 1000,
    });
}
