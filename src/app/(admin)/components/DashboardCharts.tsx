'use client';

import React from 'react';
import Link from 'next/link';

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
    pendingCount: number;
    totalActionableCount: number;
    globalTotalSessions: number;
}

export function DashboardCharts({
    sessionBreakdown,
    statusBreakdown,
    pendingCount,
    totalActionableCount,
    globalTotalSessions,
}: DashboardChartsProps) {
    const topServices = [...sessionBreakdown]
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);
    const rankedStatuses = [...statusBreakdown].sort((a, b) => b.value - a.value);
    const visibleStatuses = rankedStatuses.some((status) => status.value > 0)
        ? rankedStatuses.filter((status) => status.value > 0)
        : rankedStatuses;

    const formatPercent = (value: number) => {
        if (globalTotalSessions <= 0) return '0%';
        return `${Math.round((value / globalTotalSessions) * 100)}%`;
    };

    return (
        <section className="summary-v5-panel summary-v5-panel--insight">
            <div className="summary-v5-panel__header">
                <div>
                    <h2 className="summary-v5-panel__title">Resumen operativo</h2>
                    <p className="summary-v5-panel__hint">Datos clave sin ruido visual</p>
                </div>
            </div>

            <div className="summary-v5-insight">
                <div className="summary-v5-insight__mini-grid">
                    <article className="summary-v5-mini-chart">
                        <p className="summary-v5-mini-chart__title">Actividad acumulada</p>
                        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--sum-text)' }}>
                            {globalTotalSessions}
                        </p>
                        <p className="summary-v5-note">sesiones historicas registradas</p>
                    </article>

                    <article className="summary-v5-mini-chart">
                        <p className="summary-v5-mini-chart__title">Prioridad del dia</p>
                        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--sum-text)' }}>
                            {pendingCount}
                        </p>
                        <p className="summary-v5-note">
                            {pendingCount > 0 ? 'pendientes por confirmar' : 'sin pendientes'}
                        </p>
                    </article>
                </div>

                <div>
                    <p className="summary-v5-mini-chart__title">Top servicios</p>
                    <div className="summary-v5-legend">
                        {topServices.length > 0 ? (
                            topServices.map((item) => (
                                <div key={item.name} className="summary-v5-legend__item">
                                    <span className="summary-v5-legend__dot" style={{ backgroundColor: item.color }} />
                                    <span className="summary-v5-legend__name">{item.name}</span>
                                    <span className="summary-v5-legend__value">{formatPercent(item.value)}</span>
                                </div>
                            ))
                        ) : (
                            <div className="summary-v5-legend__item">
                                <span className="summary-v5-legend__dot" style={{ backgroundColor: '#c0c4cc' }} />
                                <span className="summary-v5-legend__name">Sin datos historicos</span>
                                <span className="summary-v5-legend__value">0%</span>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <p className="summary-v5-mini-chart__title">Estados de cita</p>
                    <div className="summary-v5-legend">
                        {visibleStatuses.map((status) => (
                            <div key={status.key} className="summary-v5-legend__item">
                                <span className="summary-v5-legend__dot" style={{ backgroundColor: status.color }} />
                                <span className="summary-v5-legend__name">{status.name}</span>
                                <span className="summary-v5-legend__value">{status.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {pendingCount > 0 ? (
                    <Link href="/citas?status=pending" style={{ textDecoration: 'none' }}>
                        <div className="summary-v5-alert summary-v5-alert--warning summary-v5-alert--interactive">
                            {pendingCount} pendientes por confirmar <span style={{ fontSize: '10px' }}>(ver)</span>
                        </div>
                    </Link>
                ) : (
                    <div className="summary-v5-alert summary-v5-alert--ok">
                        Operacion estable
                    </div>
                )}

                <p className="summary-v5-note">
                    {pendingCount > 0
                        ? `Confirma pendientes para proteger ${totalActionableCount} citas accionables del dia.`
                        : `${totalActionableCount} citas accionables en seguimiento.`}
                </p>

                <div className="summary-v5-actions">
                    <Link href="/citas" className="btn btn--primary">
                        Abrir agenda completa
                    </Link>
                </div>
            </div>
        </section>
    );
}
