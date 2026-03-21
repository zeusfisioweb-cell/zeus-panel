'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import Icon from '@/components/Icon';
import Link from 'next/link';

interface SessionBreakdownItem {
    name: string;
    value: number;
    color: string;
}

interface DashboardChartsProps {
    sessionBreakdown: SessionBreakdownItem[];
    pendingCount: number;
}

export function DashboardCharts({ sessionBreakdown, pendingCount }: DashboardChartsProps) {
    const totalSessions = sessionBreakdown.reduce((acc, curr) => acc + curr.value, 0);
    const pieShellRef = useRef<HTMLDivElement | null>(null);
    const [pieWidth, setPieWidth] = useState(0);
    const chartWidth = Math.max(220, Math.min(420, pieWidth));

    useEffect(() => {
        const node = pieShellRef.current;
        if (!node) return;

        const updateWidth = () => {
            const measured = Math.floor(node.clientWidth || 0);
            setPieWidth(measured);
        };

        updateWidth();

        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="chart-grid">
            <div className="card chart-card chart-card--distribution animate-in fade-in zoom-in-95 duration-500">
                <div className="card__header">
                    <h2 className="card__title">Distribucion de sesiones</h2>
                </div>
                <div className="card__body">
                    <div className="chart-pie-shell" ref={pieShellRef}>
                        {sessionBreakdown.length > 0 ? (
                            <>
                                {pieWidth > 0 ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
                                        <PieChart width={chartWidth} height={236}>
                                            <Pie
                                                data={sessionBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={82}
                                                paddingAngle={4}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {sessionBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: 'var(--shadow-md)' }}
                                                itemStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            />
                                        </PieChart>
                                    </div>
                                ) : (
                                    <div className="chart-empty-state">Cargando grafico...</div>
                                )}

                                <div className="chart-center">
                                    <div className="chart-center__value">{totalSessions}</div>
                                    <div className="chart-center__label">Sesiones</div>
                                </div>
                            </>
                        ) : (
                            <div className="chart-empty-state">
                                Sin sesiones en este periodo
                            </div>
                        )}
                    </div>

                    {sessionBreakdown.length > 0 && (
                        <div className="chart-mini-list">
                            {sessionBreakdown.slice(0, 3).map((item, i) => (
                                <div
                                    key={i}
                                    className="chart-mini-item"
                                    style={{ '--chart-accent': item.color } as React.CSSProperties}
                                >
                                    <div className="chart-mini-item__name">{item.name.substring(0, 14)}</div>
                                    <div className="chart-mini-item__percent">
                                        {Math.round((item.value / totalSessions) * 100)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card chart-card chart-card--attention">
                <div className="card__header">
                    <h2 className="card__title">Requiere atencion</h2>
                </div>
                <div className="card__body">
                    <div className="attention-list">
                        {pendingCount > 0 && (
                            <div className="attention-item">
                                <div className="attention-item__icon attention-item__icon--alert">
                                    <Icon name="calendar" size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p className="attention-item__title">{pendingCount} citas pendientes</p>
                                    <p className="attention-item__text">Requieren confirmacion manual</p>
                                </div>
                                <Link href="/citas" className="btn btn--sm btn--primary">Revisar</Link>
                            </div>
                        )}

                        {pendingCount === 0 && (
                            <div className="empty-state attention-empty-state">
                                <div className="attention-empty-state__icon">
                                    <Icon name="check" size={32} style={{ color: 'var(--success)' }} />
                                </div>
                                Todo al dia
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
