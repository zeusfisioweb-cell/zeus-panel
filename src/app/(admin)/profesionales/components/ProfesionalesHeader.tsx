'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface ProfesionalesHeaderProps {
    total: number;
    active: number;
    specialties: number;
    assignedServices: number;
    avgServicesPerPro: number;
    onNewProfesional: () => void;
}

export function ProfesionalesHeader({ total, active, specialties, assignedServices, avgServicesPerPro, onNewProfesional }: ProfesionalesHeaderProps) {
    const kpis = [
        { label: 'Activos', value: active, tone: 'success', icon: 'users' },
        { label: 'Especialidades', value: specialties, tone: 'info', icon: 'briefcase' },
        { label: 'Servicios asignados', value: assignedServices, tone: 'neutral', icon: 'spa' },
        { label: 'Servicios / profesional', value: avgServicesPerPro.toFixed(1), tone: 'canela', icon: 'chart' },
    ] as const;

    return (
        <header className="zs-pros-header">
            <div className="zs-pros-header__top">
                <div className="zs-pros-header__lead">
                    <span className="zs-pros-header__eyebrow">Gestión médica</span>
                    <h1 className="zs-pros-header__title">Profesionales</h1>
                    <p className="zs-pros-header__meta">{total} profesionales · {active} activos</p>
                </div>
                <div className="zs-pros-header__actions">
                    <Button variant="primary" onClick={onNewProfesional} leftIcon={<Icon name="plus" size={16} />}>
                        Nuevo profesional
                    </Button>
                </div>
            </div>

            <div className="zs-pros-kpi-strip">
                {kpis.map((k) => (
                    <div key={k.label} className={`zs-pros-kpi zs-pros-kpi--${k.tone}`}>
                        <div className="zs-pros-kpi__top">
                            <p className="zs-pros-kpi__label">{k.label}</p>
                            <span className="zs-pros-kpi__icon"><Icon name={k.icon} size={16} /></span>
                        </div>
                        <p className="zs-pros-kpi__value">{k.value}</p>
                    </div>
                ))}
            </div>
        </header>
    );
}
