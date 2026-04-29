import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requirePanelAccess } from '../../_lib';

const querySchema = z.object({
    period: z.enum(['week', 'month', 'year']).default('month'),
});

export async function GET(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });

        const url = new URL(request.url);
        const parsed = querySchema.parse({
            period: url.searchParams.get('period') ?? 'month',
        });

        const now = new Date();
        let fromDate: Date;
        let groupFn: (d: Date) => string;
        let labelFn: (key: string) => string;
        let expectedKeys: string[];

        if (parsed.period === 'week') {
            // Last 12 weeks
            fromDate = new Date(now);
            fromDate.setDate(fromDate.getDate() - 7 * 11);
            fromDate.setHours(0, 0, 0, 0);

            // Group by ISO week start (Monday)
            groupFn = (d: Date) => {
                const day = d.getDay();
                const diff = (day === 0 ? -6 : 1) - day;
                const monday = new Date(d);
                monday.setDate(d.getDate() + diff);
                return monday.toISOString().slice(0, 10);
            };
            labelFn = (key: string) => {
                const [, month, day] = key.split('-');
                return `${day}/${month}`;
            };

            // Build expected Monday keys
            expectedKeys = [];
            const cursor = new Date(now);
            const curDay = cursor.getDay();
            const diff = (curDay === 0 ? -6 : 1) - curDay;
            cursor.setDate(cursor.getDate() + diff);
            cursor.setHours(0, 0, 0, 0);
            for (let i = 11; i >= 0; i--) {
                const d = new Date(cursor);
                d.setDate(cursor.getDate() - 7 * i);
                expectedKeys.push(d.toISOString().slice(0, 10));
            }
        } else if (parsed.period === 'month') {
            // Last 12 months
            fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

            groupFn = (d: Date) => {
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            };
            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            labelFn = (key: string) => {
                const [, month] = key.split('-');
                return monthNames[parseInt(month, 10) - 1] ?? key;
            };

            expectedKeys = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                expectedKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }
        } else {
            // Last 5 years
            fromDate = new Date(now.getFullYear() - 4, 0, 1);

            groupFn = (d: Date) => String(d.getFullYear());
            labelFn = (key: string) => key;

            expectedKeys = [];
            for (let i = 4; i >= 0; i--) {
                expectedKeys.push(String(now.getFullYear() - i));
            }
        }

        const { data, error } = await supabase
            .from('patients')
            .select('created_at')
            .is('deleted_at', null)
            .gte('created_at', fromDate.toISOString());

        if (error) throw error;

        // Group counts by period bucket
        const counts: Record<string, number> = {};
        for (const key of expectedKeys) {
            counts[key] = 0;
        }
        for (const row of data ?? []) {
            const d = new Date(row.created_at);
            const key = groupFn(d);
            if (key in counts) {
                counts[key]++;
            }
        }

        // Build cumulative totals - get baseline count before fromDate
        const { count: baselineCount } = await supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .lt('created_at', fromDate.toISOString());

        const baseline = baselineCount ?? 0;

        let running = baseline;
        const points = expectedKeys.map((key) => {
            running += counts[key];
            return {
                label: labelFn(key),
                key,
                new_patients: counts[key],
                total_patients: running,
            };
        });

        // KPI calculations
        const { count: totalActive } = await supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null);

        const { count: consentCount } = await supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('gdpr_consent', true);

        const { count: marketingCount } = await supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('marketing_consent', true);

        const kpis = {
            total: totalActive ?? 0,
            gdprConsentRate: totalActive ? Math.round(((consentCount ?? 0) / totalActive) * 100) : 0,
            marketingConsentRate: totalActive ? Math.round(((marketingCount ?? 0) / totalActive) * 100) : 0,
        };

        return NextResponse.json({ points, period: parsed.period, kpis });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
