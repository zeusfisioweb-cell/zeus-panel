'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import type { Appointment, DashboardGlobalStats, DashboardStatsSummary } from '@/lib/types';

interface DashboardStatsProps {
    stats: DashboardStatsSummary;
    globalStats: DashboardGlobalStats;
    todayAppointments: Appointment[];
}

export function DashboardStats({ stats, globalStats, todayAppointments }: DashboardStatsProps) {
    const { profile } = useAuth();
    const isOwner = profile?.role === 'owner';

    const formatter = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    });

    const metrics = [
        isOwner ? {
            id: 'revenue',
            label: 'Ingresos est. (Historico)',
            value: formatter.format(globalStats.estimatedRevenue),
            hint: 'citas completadas',
            tone: 'primary',
            href: '/citas?status=completed',
        } : {
            id: 'completed-sessions',
            label: 'Sesiones completadas',
            value: globalStats.globalStatus.completed || 0,
            hint: 'tratamientos finalizados',
            tone: 'primary',
            href: '/citas?status=completed',
        },
        {
            id: 'patients',
            label: 'Total pacientes',
            value: stats.totalPatients,
            hint: 'registrados en el centro',
            tone: 'info',
            href: '/pacientes',
        },
        {
            id: 'global-appointments',
            label: 'Citas historicas',
            value: globalStats.totalGlobalAppointments,
            hint: 'sin canceladas',
            tone: 'neutral',
            href: '/citas',
        },
        {
            id: 'pending',
            label: 'Citas pendientes',
            value: globalStats.globalStatus.pending,
            hint: globalStats.globalStatus.pending > 0 ? 'pendientes de confirmacion' : 'sin pendientes',
            tone: globalStats.globalStatus.pending > 0 ? 'warning' : 'success',
            href: '/citas?status=pending',
        },
    ] as const;

    const pendingOrConfirmedToday = todayAppointments.filter((apt) => apt.status === 'pending' || apt.status === 'confirmed').length;

    return (
        <section className="summary-v5-kpis" aria-label="Indicadores operativos">
            <div className="summary-v5-ribbon" role="list" aria-label="Metricas clave">
                {metrics.map((metric) => (
                    <Link href={metric.href} key={metric.id} className="summary-v5-ribbon-link" style={{ textDecoration: 'none' }}>
                        <article role="listitem" className={`summary-v5-ribbon__metric summary-v5-ribbon__metric--${metric.tone} summary-v5-ribbon__metric--interactive`}>
                            <p className="summary-v5-ribbon__label">{metric.label}</p>
                            <p className="summary-v5-ribbon__value">{metric.value}</p>
                            <p className="summary-v5-ribbon__hint">{metric.hint}</p>
                        </article>
                    </Link>
                ))}
            </div>

            <p className="summary-v5-context-inline">
                {isOwner
                    ? `Resumen global: ${globalStats.totalGlobalAppointments} citas y ${formatter.format(globalStats.estimatedRevenue)} estimados.`
                    : `Hoy tienes ${pendingOrConfirmedToday} citas accionables y ${stats.pendingCount} pendientes.`}
            </p>
        </section>
    );
}
