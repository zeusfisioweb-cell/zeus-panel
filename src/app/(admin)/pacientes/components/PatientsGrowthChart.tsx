'use client';

import React, { useId, useState, useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';
import { usePatientsGrowth, PatientGrowthPeriod, PatientGrowthPoint } from '@/hooks/usePacientes';

type MetricType = 'new' | 'total';

interface TooltipProps {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: string;
}

const PERIOD_LABELS: Record<PatientGrowthPeriod, string> = {
    week:  'Sem',
    month: 'Mes',
    year:  'Año',
};

const METRIC_LABELS: Record<MetricType, string> = {
    new: 'Nuevos',
    total: 'Acumulado',
};

function CustomTooltip({ active, payload, label }: TooltipProps) {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    return (
        <div className="zs-pgc__tooltip">
            <span className="zs-pgc__tooltip-label">{label}</span>
            <span className="zs-pgc__tooltip-val">
                {val} <span className="zs-pgc__tooltip-unit">clientes</span>
            </span>
        </div>
    );
}

export function PatientsGrowthChart() {
    const [period, setPeriod] = useState<PatientGrowthPeriod>('month');
    const [metric, setMetric] = useState<MetricType>('new');
    const { data, isLoading } = usePatientsGrowth(period);

    const gradId = `pgc-grad-${useId().replace(/:/g, '')}`;
    const points: PatientGrowthPoint[] = useMemo(() => data?.points ?? [], [data?.points]);

    const { currentValue, delta, deltaPct, hasDelta } = useMemo(() => {
        if (points.length === 0) return { currentValue: 0, delta: 0, deltaPct: 0, hasDelta: false };
        const current = points[points.length - 1];
        const previous = points.length >= 2 ? points[points.length - 2] : null;
        const cv = metric === 'new' ? current.new_patients : current.total_patients;
        const pv = previous ? (metric === 'new' ? previous.new_patients : previous.total_patients) : 0;
        const d = cv - pv;
        const dp = pv > 0 ? Math.round((d / pv) * 100) : 0;
        return { currentValue: cv, delta: d, deltaPct: dp, hasDelta: previous !== null };
    }, [points, metric]);

    const strokeColor = metric === 'new' ? '#2563EB' : '#AD7332';
    const isPositive = delta >= 0;

    return (
        <div className="zs-pgc">
            <div className="zs-pgc__header">
                <div className="zs-pgc__heading">
                    <p className="zs-charts-card__title">
                        {metric === 'new' ? 'Captación de clientes' : 'Base de pacientes activos'}
                    </p>
                    <p className="zs-charts-card__hint">evolución temporal</p>
                </div>

                <div className="zs-pgc__controls">
                    <div className="zs-pgc__seg" role="group" aria-label="Métrica">
                        {(['new', 'total'] as MetricType[]).map((m) => (
                            <button
                                key={m} type="button" aria-pressed={metric === m}
                                className={`zs-pgc__seg-btn${metric === m ? ' is-active' : ''}`}
                                onClick={() => setMetric(m)}
                            >
                                {METRIC_LABELS[m]}
                            </button>
                        ))}
                    </div>
                    <div className="zs-pgc__seg" role="group" aria-label="Periodo">
                        {(['week', 'month', 'year'] as PatientGrowthPeriod[]).map((p) => (
                            <button
                                key={p} type="button" aria-pressed={period === p}
                                className={`zs-pgc__seg-btn${period === p ? ' is-active' : ''}`}
                                onClick={() => setPeriod(p)}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {!isLoading && (
                <div className="zs-pgc__kpi">
                    <span className="zs-pgc__kpi-num">{currentValue}</span>
                    {hasDelta && (
                        <span className={`zs-pgc__kpi-delta${isPositive ? ' is-up' : ' is-down'}`}>
                            {isPositive ? '↑' : '↓'} {Math.abs(delta)} ({Math.abs(deltaPct)}%)
                        </span>
                    )}
                    <span className="zs-pgc__kpi-hint">vs período anterior</span>
                </div>
            )}

            {isLoading ? (
                <div className="zs-pgc__loading">
                    <div className="spinner w-6 h-6" />
                </div>
            ) : points.length === 0 ? (
                <div className="zs-pgc__empty">Sin datos suficientes para este periodo</div>
            ) : (
                <div className="zs-pgc__chart">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
                            <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.22} />
                                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(173,115,50,0.12)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
                                axisLine={false} tickLine={false}
                                interval="preserveStartEnd" dy={8}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
                                axisLine={false} tickLine={false}
                                allowDecimals={false} dx={-6}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ stroke: strokeColor, strokeWidth: 1, strokeDasharray: '4 4', fill: 'transparent' }}
                            />
                            <Area
                                type="monotone"
                                dataKey={metric === 'new' ? 'new_patients' : 'total_patients'}
                                stroke={strokeColor} strokeWidth={2.5}
                                fill={`url(#${gradId})`}
                                dot={false}
                                activeDot={{ r: 5, fill: '#fff', stroke: strokeColor, strokeWidth: 2 }}
                                animationDuration={800}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
