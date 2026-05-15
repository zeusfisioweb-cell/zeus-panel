'use client';

import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--chart-6)',
    'var(--chart-7)',
    'var(--chart-8)',
];

interface DonutItem {
    name: string;
    value: number;
    color?: string;
}

interface DonutChartProps {
    data: DonutItem[];
    centerLabel?: string;
    centerValue?: string | number;
    height?: number;
    showLegend?: boolean;
    ariaLabel?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: DonutItem }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
        <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-main)',
            boxShadow: 'var(--shadow-md)',
        }}>
            <span>{item.name}</span>
            <strong style={{ marginLeft: 8, color: 'var(--brand-canela)' }}>{item.value}</strong>
        </div>
    );
}

export function DonutChart({
    data,
    centerLabel,
    centerValue,
    height = 220,
    showLegend = true,
    ariaLabel,
}: DonutChartProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const hasData = total > 0;

    const chartData = hasData ? data : [{ name: 'Sin datos', value: 1, color: '#e5e7eb' }];
    const resolvedAriaLabel = ariaLabel ?? (hasData
        ? `${centerLabel ?? 'Distribución'}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`
        : 'Sin datos');

    return (
        <div className="zs-donut-wrapper" style={{ minWidth: 0, width: '100%' }} role="img" aria-label={resolvedAriaLabel}>
            <div style={{ position: 'relative', height, overflow: 'hidden' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius="54%"
                            outerRadius="78%"
                            paddingAngle={hasData ? 2 : 0}
                            dataKey="value"
                            strokeWidth={0}
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                                    opacity={hasData ? 1 : 0.3}
                                />
                            ))}
                        </Pie>
                        {hasData && <Tooltip content={<CustomTooltip />} />}
                    </PieChart>
                </ResponsiveContainer>

                {(centerLabel || centerValue !== undefined) && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}>
                        {centerValue !== undefined && (
                            <strong style={{
                                fontSize: 28,
                                lineHeight: 1,
                                fontWeight: 800,
                                color: 'var(--text-main)',
                                letterSpacing: '-0.03em',
                                fontFamily: 'var(--font-zeus-display, serif)',
                            }}>
                                {hasData ? centerValue : '—'}
                            </strong>
                        )}
                        {centerLabel && (
                            <span style={{
                                marginTop: 4,
                                fontSize: 10,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                            }}>
                                {centerLabel}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {showLegend && hasData && (
                <div className="zs-donut-legend">
                    {data.map((item, index) => {
                        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                        return (
                            <div key={item.name} className="zs-donut-legend__item">
                                <span
                                    className="zs-donut-legend__dot"
                                    style={{ background: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <span className="zs-donut-legend__name">{item.name}</span>
                                <span className="zs-donut-legend__pct">{pct}%</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
