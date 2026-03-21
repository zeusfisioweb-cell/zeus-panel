'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth-context';

interface DashboardStatsProps {
    stats: {
        totalPatients: number;
        todayCount: number;
        weekCount: number;
        pendingCount: number;
    };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
    const { profile } = useAuth();
    const isOwner = profile?.role === 'owner';

    const cards = [
        {
            id: 'today',
            icon: 'calendar',
            value: stats.todayCount,
            label: 'Citas hoy',
        },
        {
            id: 'pending',
            icon: 'clock',
            value: stats.pendingCount,
            label: 'Pendientes',
        },
        isOwner
            ? {
                id: 'patients',
                icon: 'users',
                value: stats.totalPatients,
                label: 'Pacientes',
            }
            : null,
        {
            id: 'week',
            icon: 'activity',
            value: stats.weekCount,
            label: 'Esta semana',
        },
    ].filter(Boolean) as Array<{
        id: string;
        icon: string;
        value: number;
        label: string;
    }>;

    return (
        <div className="stats-grid stats-grid--dashboard">
            {cards.map((card) => (
                <article key={card.id} className="metric-card metric-card--dashboard">
                    <div className="metric-card__top">
                        <span className="metric-card__icon">
                            <Icon name={card.icon} size={18} />
                        </span>
                    </div>
                    <p className="metric-card__value">{card.value}</p>
                    <p className="metric-card__label">{card.label}</p>
                </article>
            ))}
        </div>
    );
}
