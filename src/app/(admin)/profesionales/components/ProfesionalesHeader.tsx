'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface ProfesionalesHeaderProps {
    total: number;
    active: number;
    services: number;
    onNewProfesional: () => void;
}

export function ProfesionalesHeader({ total, active, services, onNewProfesional }: ProfesionalesHeaderProps) {
    return (
        <header className="module-header module-header--profesionales">
            <div>
                <span className="module-header__kicker">Equipo</span>
                <h1 className="module-header__title">Profesionales</h1>
                <p className="module-header__desc">
                    Equipo, especialidades y disponibilidad en una sola vista.
                </p>
                <p className="module-header__meta">
                    {active}/{total} profesionales activos | {services} servicios asignables
                </p>
            </div>
            <div className="module-header__actions">
                <Button variant="primary" onClick={onNewProfesional} leftIcon={<Icon name="plus" size={16} />}>
                    Nuevo profesional
                </Button>
            </div>
        </header>
    );
}
