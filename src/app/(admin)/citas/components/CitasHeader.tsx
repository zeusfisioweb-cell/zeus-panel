'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface CitasHeaderProps {
    mainPageViewMode: 'list' | 'calendar';
    setMainPageViewMode: (mode: 'list' | 'calendar') => void;
    onToday: () => void;
    onBlockSchedule: () => void;
    onNewAppointment: () => void;
}

export function CitasHeader({
    mainPageViewMode,
    setMainPageViewMode,
    onToday,
    onBlockSchedule,
    onNewAppointment,
}: CitasHeaderProps) {
    const viewOptions = [
        { key: 'calendar', label: 'Calendario', icon: 'calendar' },
        { key: 'list', label: 'Lista', icon: 'list' },
    ] as const;

    return (
        <div className="zs-ch-wrap">
            <div className="zs-ch-actions w-full justify-between">
                <div className="flex items-center gap-3">
                    <div className="citas-segment">
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

                    <div className="w-px h-6 bg-[var(--border-color)] hidden sm:block" />

                    <Button variant="secondary" onClick={onToday} className="h-9 px-4 hidden sm:flex !rounded-[10px]">
                        Hoy
                    </Button>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button
                        variant="secondary"
                        onClick={onBlockSchedule}
                        leftIcon={<Icon name="lock" size={14} />}
                        className="h-9 !rounded-[10px]"
                    >
                        <span className="hidden sm:inline">Bloquear Horario</span>
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onNewAppointment}
                        leftIcon={<Icon name="plus" size={15} />}
                        className="h-9 px-5 !rounded-xl"
                    >
                        Nueva cita
                    </Button>
                </div>
            </div>
        </div>
    );
}
