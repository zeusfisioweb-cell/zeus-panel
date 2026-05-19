'use client';

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/lib/auth-context';
import type { Appointment, DashboardGlobalStats, DashboardStatsSummary } from '@/lib/types';

interface DashboardStatsProps {
    stats: DashboardStatsSummary;
    globalStats: DashboardGlobalStats;
    todayAppointments: Appointment[];
}

function MetricCard({
    tone,
    label,
    value,
    hint,
    href,
    icon,
    badge,
}: {
    tone: string;
    label: string;
    value: string | number;
    hint: string;
    href: string;
    icon: React.ReactNode;
    badge?: { text: string; color: string };
}) {
    return (
        <Link href={href} className="zs-kpi-link no-underline">
            <article className={`zs-kpi zs-kpi--${tone}`}>
                <div className="zs-kpi__top">
                    <p className="zs-kpi__label">{label}</p>
                    <span className="zs-kpi__icon">{icon}</span>
                </div>
                <p className="zs-kpi__value">{value}</p>
                {badge ? (
                    <p className="zs-kpi__hint">
                        <span
                            className="inline-block py-px px-[7px] rounded-full text-[10px] font-extrabold tracking-[0.05em] text-white mr-[5px]"
                            style={{ background: badge.color }}
                        >{badge.text}</span>
                        {hint}
                    </p>
                ) : (
                    <p className="zs-kpi__hint">{hint}</p>
                )}
            </article>
        </Link>
    );
}

export function DashboardStats({ stats, globalStats, todayAppointments }: DashboardStatsProps) {
    const { profile } = useAuth();
    const isOwner = profile?.role === 'owner';

    const now = new Date();

    // Derived today metrics (exclude cancelled from totals)
    const totalToday = todayAppointments.filter((a) => a.status !== 'cancelled').length;
    const completedToday = todayAppointments.filter((a) => a.status === 'completed').length;
    const remainingToday = todayAppointments.filter(
        (a) => a.status === 'confirmed' && new Date(a.end_time) > now
    ).length;

    // Next upcoming appointment
    const nextApt = todayAppointments
        .filter((a) => a.status === 'confirmed' && new Date(a.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

    const nextTime = nextApt
        ? format(new Date(nextApt.start_time), 'HH:mm', { locale: es })
        : null;

    // Progress % of today
    const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    return (
        <section className="summary-v5-kpis" aria-label="Indicadores del día">
            <div className="zs-kpi-grid" role="list" aria-label="Métricas clave de hoy">

                {/* 1 — Citas hoy */}
                <MetricCard
                    tone="primary"
                    label="Citas hoy"
                    value={totalToday}
                    hint={totalToday === 0 ? 'sin citas programadas' : `${remainingToday} pendientes de atender`}
                    href="/citas"
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    }
                />

                {/* 2 — Completadas hoy */}
                <MetricCard
                    tone={completedToday > 0 ? 'success' : 'neutral'}
                    label="Completadas hoy"
                    value={completedToday}
                    hint={`${progressPct}% del día completado`}
                    href="/citas?status=completed"
                    badge={totalToday > 0 ? { text: `${progressPct}%`, color: completedToday === totalToday && totalToday > 0 ? '#059669' : '#2563EB' } : undefined}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    }
                />

                {/* 3 — Próxima cita (profesional) / Ingresos (owner) */}
                {isOwner ? (
                    <MetricCard
                        tone={globalStats.estimatedRevenue > 0 ? 'success' : 'neutral'}
                        label="Ingresos completados"
                        value={globalStats.estimatedRevenue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        hint={`${stats.totalPatients} pacientes registrados`}
                        href="/pacientes"
                        icon={
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                        }
                    />
                ) : (
                    <MetricCard
                        tone={nextTime ? 'info' : 'neutral'}
                        label="Próxima cita"
                        value={nextTime ?? '—'}
                        hint={nextApt
                            ? `${(nextApt as Appointment & { patient_name?: string }).patient_name ?? 'Paciente'}`
                            : 'no quedan citas hoy'}
                        href="/citas"
                        icon={
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                        }
                    />
                )}

                {/* 4 — Esta semana */}
                <MetricCard
                    tone="info"
                    label="Esta semana"
                    value={stats.weekCount}
                    hint="citas programadas"
                    href="/citas"
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>
                        </svg>
                    }
                />

            </div>

            <p className="summary-v5-context-inline">
                {isOwner
                    ? `Hoy: ${totalToday} citas · ${completedToday} completadas · ${stats.totalPatients} pacientes.`
                    : `Tienes ${remainingToday} citas confirmadas por atender hoy.`}
            </p>
        </section>
    );
}
