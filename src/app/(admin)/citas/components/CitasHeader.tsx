'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface CitasHeaderProps {
    mainPageViewMode: 'list' | 'calendar';
    setMainPageViewMode: (mode: 'list' | 'calendar') => void;
    totalCount: number;
    pendingCount: number;
    confirmedCount: number;
    completedCount: number;
    onToday: () => void;
    onBlockSchedule: () => void;
    onNewAppointment: () => void;
}

export function CitasHeader({
    mainPageViewMode,
    setMainPageViewMode,
    totalCount,
    pendingCount,
    confirmedCount,
    completedCount,
    onToday,
    onBlockSchedule,
    onNewAppointment,
}: CitasHeaderProps) {
    const activeCount = pendingCount + confirmedCount + completedCount;
    const completionRate = activeCount > 0 ? Math.round((completedCount / activeCount) * 100) : 0;

    const viewOptions = [
        { key: 'calendar', label: 'Calendario', icon: 'calendar' },
        { key: 'list', label: 'Lista', icon: 'list' },
    ] as const;

    return (
        <div className="citas-control-wrap">
            <div className="citas-control-hero h-[auto] py-4">
                <div className="citas-control-hero__top border-b-0 pb-0">
                    <div className="citas-control-hero__lead">
                        <span className="citas-control-hero__eyebrow">Agenda Clínica</span>
                        <h2 className="citas-control-hero__title">Módulo de citas</h2>
                        <p className="citas-control-hero__subtitle flex gap-2 items-center text-[13px]">
                            <span>{activeCount} citas activas de {totalCount} este mes.</span>
                            <span className="opacity-50">|</span>
                            <span>{pendingCount} pendientes</span>
                            <span className="opacity-50">|</span>
                            <span className="text-green-600 dark:text-green-500 font-medium">{completionRate}% completadas</span>
                        </p>
                    </div>

                    <div className="citas-control-hero__actions flex items-center gap-3">
                        <div className="citas-segment mr-2">
                            {viewOptions.map((option) => (
                                <button
                                    key={option.key}
                                    className={`citas-segment__btn ${mainPageViewMode === option.key ? 'is-active' : ''}`}
                                    type="button"
                                    onClick={() => setMainPageViewMode(option.key)}
                                    aria-pressed={mainPageViewMode === option.key}
                                    title={`Ver como ${option.label}`}
                                >
                                    <Icon name={option.icon} size={14} />
                                    <span className="hidden sm:inline">{option.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="w-[1px] h-8 bg-[var(--border-color)] opacity-50 mr-1" />

                        <Button variant="secondary" onClick={onToday} className="h-9 px-4 hidden sm:flex">
                            Hoy
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={onBlockSchedule}
                            leftIcon={<Icon name="lock" size={14} />}
                            className="h-9"
                        >
                            <span className="hidden sm:inline">Bloquear</span>
                        </Button>
                        <Button
                            variant="primary"
                            onClick={onNewAppointment}
                            leftIcon={<Icon name="plus" size={15} />}
                            className="h-9 shadow-sm"
                        >
                            Nueva cita
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

