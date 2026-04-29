'use client';

import React, { useId } from 'react';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

interface SparkAreaProps {
    data: number[];
    color?: string;
    height?: number;
    showTooltip?: boolean;
    ariaLabel?: string;
}

export function SparkArea({
    data,
    color = 'var(--brand-canela)',
    height = 40,
    showTooltip = false,
    ariaLabel,
}: SparkAreaProps) {
    const chartData = data.map((v, i) => ({ i, v }));
    const gradId = `spark-grad-${useId().replace(/:/g, '')}`;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const last = data[data.length - 1] ?? 0;

    return (
        <div role="img" aria-label={ariaLabel ?? `Tendencia: mínimo ${min}, máximo ${max}, último ${last}`}>
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="v"
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#${gradId})`}
                        dot={false}
                        activeDot={showTooltip ? { r: 3, fill: color, strokeWidth: 0 } : false}
                        animationDuration={600}
                    />
                    {showTooltip && (
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                    <div style={{
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '4px 8px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: 'var(--text-main)',
                                    }}>
                                        {payload[0].value}
                                    </div>
                                );
                            }}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
