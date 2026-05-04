'use client';

import React from 'react';
import Link from 'next/link';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChartH } from '@/components/charts/BarChartH';
import { RadialRing } from '@/components/charts/RadialRing';
import { PatientsGrowthChart } from '../pacientes/components/PatientsGrowthChart';

interface SessionBreakdownItem {
    name: string;
    value: number;
    color: string;
}

interface StatusBreakdownItem {
    key: string;
    name: string;
    value: number;
    color: string;
}

interface DashboardChartsProps {
    sessionBreakdown: SessionBreakdownItem[];
    statusBreakdown: StatusBreakdownItem[];
    totalActionableCount: number;
    globalTotalSessions: number;
}

export function DashboardCharts({
    sessionBreakdown,
    statusBreakdown,
    totalActionableCount,
    globalTotalSessions,
}: DashboardChartsProps) {
    const completedCount = statusBreakdown.find((s) => s.key === 'completed')?.value ?? 0;
    const occupancyPct = globalTotalSessions > 0
        ? Math.round((completedCount / globalTotalSessions) * 100)
        : 0;

    const barData = statusBreakdown.map((s) => ({
        name: s.name,
        shortName: s.name,
        value: s.value,
        color: s.color,
    }));

    return (
        <section className="zs-charts-panel" aria-label="Gráficos operativos">
            {/* Row 1: Donut + Bar side by side */}
            <div className="zs-charts-row">
                {/* Services donut */}
                <div className="zs-charts-card">
                    <div className="zs-charts-card__header">
                        <p className="zs-charts-card__title">Top servicios</p>
                        <p className="zs-charts-card__hint">por sesiones</p>
                    </div>
                    <DonutChart
                        data={sessionBreakdown.slice(0, 6)}
                        centerLabel="ses. activas"
                        centerValue={globalTotalSessions}
                        height={200}
                        showLegend={true}
                    />
                </div>

                {/* Status bar */}
                <div className="zs-charts-card">
                    <div className="zs-charts-card__header">
                        <p className="zs-charts-card__title">Estado de citas</p>
                        <p className="zs-charts-card__hint">distribución total</p>
                    </div>
                    <BarChartH data={barData} height={180} axisWidth={90} />

                    {/* Occupancy ring */}
                    <div className="zs-occ-strip">
                        <RadialRing value={occupancyPct} size={72} />
                        <div className="zs-occ-strip__copy">
                            <p className="zs-occ-strip__title">Completadas</p>
                            <p className="zs-occ-strip__sub">
                                {completedCount} de {globalTotalSessions} sesiones (sin canceladas)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 2: Patients growth — full width, same card style */}
            <div className="zs-charts-card p-6">
                <PatientsGrowthChart />
            </div>

            {/* Status summary */}
            <div className="zs-alert zs-alert--ok">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Operación estable — {totalActionableCount} citas en seguimiento</span>
            </div>

            <div className="zs-charts-actions">
                <Link href="/citas" className="btn btn--primary w-full text-center">
                    Abrir agenda completa
                </Link>
            </div>
        </section>
    );
}
