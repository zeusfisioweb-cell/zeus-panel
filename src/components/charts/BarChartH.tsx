'use client';

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface BarItem {
    name: string;
    value: number;
    color?: string;
    shortName?: string;
}

interface BarChartHProps {
    data: BarItem[];
    height?: number;
    ariaLabel?: string;
    axisWidth?: number;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number; payload: BarItem }>;
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
            <span>{item.payload.name}</span>
            <strong style={{ marginLeft: 8, color: 'var(--brand-canela)' }}>{item.value}</strong>
        </div>
    );
}

export function BarChartH({ data, height = 200, ariaLabel, axisWidth = 72 }: BarChartHProps) {
    const hasData = data.some((d) => d.value > 0);
    const resolvedAriaLabel = ariaLabel ?? `Gráfico de barras: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`;

    return (
        <div role="img" aria-label={resolvedAriaLabel} style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={5}
                    allowDecimals={false}
                />
                <YAxis
                    type="category"
                    dataKey="shortName"
                    width={axisWidth}
                    tick={{ fontSize: 11, fill: 'var(--text-main)', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                />
                {hasData && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(173,115,50,0.06)' }} />}
                <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={20}
                    animationBegin={0}
                    animationDuration={800}
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.color ?? 'var(--chart-1)'}
                            opacity={hasData && entry.value === 0 ? 0.25 : 1}
                        />
                    ))}
                </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
