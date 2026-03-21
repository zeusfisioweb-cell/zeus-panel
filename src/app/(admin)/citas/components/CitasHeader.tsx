'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface CitasHeaderProps {
    mainPageViewMode: 'list' | 'calendar';
    setMainPageViewMode: (mode: 'list' | 'calendar') => void;
    calViewMode: 'list' | 'day' | 'week';
    setCalViewMode: (mode: 'list' | 'day' | 'week') => void;
    totalCount: number;
    pendingCount: number;
    onToday: () => void;
    onBlockSchedule: () => void;
    onNewAppointment: () => void;
}

export function CitasHeader({
    mainPageViewMode,
    setMainPageViewMode,
    calViewMode,
    setCalViewMode,
    totalCount,
    pendingCount,
    onToday,
    onBlockSchedule,
    onNewAppointment,
}: CitasHeaderProps) {
    return (
        <header className="module-header module-header--citas">
            <div className="citas-header__intro">
                <span className="module-header__kicker">Gestión</span>
                <h1 className="module-header__title">Citas</h1>
                <p className="module-header__desc">
                    Gestiona tu agenda de citas de forma rápida y sencilla.
                </p>
                <p className="module-header__meta">
                    {totalCount} citas · {pendingCount} pendientes
                </p>
            </div>

            <div className="module-header__actions citas-header__actions">
                <div className="citas-header__group">
                    <span className="citas-header__group-label">Datos</span>
                    <div className="citas-kpis">
                        <div className="citas-kpi-pill">
                            <span>Total</span>
                            <strong>{totalCount}</strong>
                        </div>
                        <div className="citas-kpi-pill citas-kpi-pill--alert">
                            <span>Pendientes</span>
                            <strong>{pendingCount}</strong>
                        </div>
                    </div>
                </div>

                <div className="citas-header__group">
                    <span className="citas-header__group-label">Modo</span>
                    <div className="citas-toggle" role="tablist" aria-label="Modo de vista de citas">
                        <button
                            className={`citas-toggle__btn ${mainPageViewMode === 'list' ? 'is-active' : ''}`}
                            type="button"
                            onClick={() => setMainPageViewMode('list')}
                            aria-pressed={mainPageViewMode === 'list'}
                            aria-label="Cambiar a vista de lista"
                        >
                            <Icon name="list" size={15} />
                            Lista
                        </button>
                        <button
                            className={`citas-toggle__btn ${mainPageViewMode === 'calendar' ? 'is-active' : ''}`}
                            type="button"
                            onClick={() => setMainPageViewMode('calendar')}
                            aria-pressed={mainPageViewMode === 'calendar'}
                            aria-label="Cambiar a vista de calendario"
                        >
                            <Icon name="calendar" size={15} />
                            Calendario
                        </button>
                    </div>
                </div>

                {mainPageViewMode === 'calendar' && (
                    <div className="citas-header__group">
                        <span className="citas-header__group-label">Calendario</span>
                        <div className="citas-toggle citas-toggle--secondary" role="tablist" aria-label="Escala del calendario">
                            <button
                                className={`citas-toggle__btn ${calViewMode === 'day' ? 'is-active' : ''}`}
                                type="button"
                                onClick={() => setCalViewMode('day')}
                                aria-pressed={calViewMode === 'day'}
                                aria-label="Ver calendario por día"
                            >
                                Dia
                            </button>
                            <button
                                className={`citas-toggle__btn ${calViewMode === 'week' ? 'is-active' : ''}`}
                                type="button"
                                onClick={() => setCalViewMode('week')}
                                aria-pressed={calViewMode === 'week'}
                                aria-label="Ver calendario por semana"
                            >
                                Semana
                            </button>
                        </div>
                    </div>
                )}

                <div className="citas-header__group citas-header__group--actions">
                    <span className="citas-header__group-label">Atajos</span>
                    <div className="citas-actions">
                        <Button variant="secondary" onClick={onToday}>
                            Hoy
                        </Button>
                        <Button variant="secondary" onClick={onBlockSchedule} leftIcon={<Icon name="lock" size={14} />}>
                            Bloquear horario
                        </Button>
                        <Button variant="primary" onClick={onNewAppointment} leftIcon={<Icon name="plus" size={15} />}>
                            Nueva cita
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
