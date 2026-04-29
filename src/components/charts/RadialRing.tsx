'use client';

import React from 'react';
import {
    RadialBarChart,
    RadialBar,
    ResponsiveContainer,
} from 'recharts';

interface RadialRingProps {
    value: number; /* 0-100 */
    label?: string;
    size?: number;
    color?: string;
    thickness?: number;
}

export function RadialRing({
    value,
    label,
    size = 80,
    color = 'var(--brand-canela)',
    thickness = 10,
}: RadialRingProps) {
    const clamped = Math.min(100, Math.max(0, value));
    const data = [{ value: clamped, fill: color }];

    return (
        <div
            role="img"
            aria-label={label ? `${label}: ${Math.round(clamped)} por ciento` : `${Math.round(clamped)} por ciento`}
            style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius={`${100 - thickness * 2.2}%`}
                    outerRadius="100%"
                    barSize={thickness}
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                >
                    <RadialBar
                        background={{ fill: 'rgba(173,115,50,0.1)' }}
                        dataKey="value"
                        cornerRadius={thickness / 2}
                        animationBegin={0}
                        animationDuration={900}
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
            }}>
                <strong style={{
                    fontSize: size * 0.22,
                    lineHeight: 1,
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    letterSpacing: '-0.02em',
                }}>
                    {Math.round(clamped)}%
                </strong>
                {label && (
                    <span style={{
                        fontSize: size * 0.13,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginTop: 2,
                    }}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}
