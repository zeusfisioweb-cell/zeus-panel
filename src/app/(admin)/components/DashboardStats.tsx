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
        <Link href={href} className="zs-kpi-link" style={{ textDecoration: 'none' }}>
            <article className={`zs-kpi zs-kpi--${tone}`}>
                <div className="zs-kpi__top">
                    <p className="zs-kpi__label">{label}</p>
                    <span className="zs-kpi__icon">{icon}</span>
                </div>
                <p className="zs-kpi__value">{value}</p>
                {badge ? (
                    <p className="zs-kpi__hint">
                        <span style={{
                            display: 'inline-block',
                            padding: '1px 7px',
                            borderRadius: '999px',
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            background: badge.color,
                            color: '#fff',
                            marginRight: 5,
                        }}>{badge.text}</span>
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
    const pendingToday = todayAppointments.filter((a) => a.status === 'pending').length;
    const remainingToday = todayAppointments.filter(
        (a) => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.end_time) > now
    ).length;

    // Next upcoming appointment
    const nextApt = todayAppointments
        .filter((a) => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

    const nextTime = nextApt
        ? format(new Date(nextApt.start_time), 'HH:mm', { locale: es })
        : null;

    // Progress % of today
    const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    // Global pending needing attention
    const globalPending = globalStats.globalStatus.pending;

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
                        value={`€${globalStats.estimatedRevenue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
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

                {/* 4 — Alertas: pendientes de confirmar */}
                <MetricCard
                    tone={globalPending > 0 ? 'warning' : 'success'}
                    label={globalPending > 0 ? 'Sin confirmar' : 'Todo confirmado'}
                    value={globalPending > 0 ? globalPending : '✓'}
                    hint={
                        globalPending > 0
                            ? 'solicitudes esperando tu acción'
                            : `${pendingToday === 0 ? 'ninguna' : pendingToday} sin resolver hoy`
                    }
                    href="/citas?status=pending"
                    badge={globalPending > 5 ? { text: 'URGENTE', color: '#dc2626' } : undefined}
                    icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    }
                />

            </div>

            <p className="summary-v5-context-inline">
                {isOwner
                    ? `Hoy: ${totalToday} citas · ${completedToday} completadas · ${globalPending} sin confirmar · ${stats.totalPatients} pacientes.`
                    : `Tienes ${remainingToday} citas pendientes de atender hoy y ${globalPending} solicitudes por confirmar.`}
            </p>
        </section>
    );
}
