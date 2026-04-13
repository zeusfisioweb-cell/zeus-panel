'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface ProfesionalesHeaderProps {
    total: number;
    active: number;
    specialties: number;
    assignedServices: number;
    onNewProfesional: () => void;
}

export function ProfesionalesHeader({ total, active, specialties, assignedServices, onNewProfesional }: ProfesionalesHeaderProps) {
    return (
        <header className="module-header module-header--profesionales ops-module-head">
            <div className="ops-module-head__intro">
                <span className="module-header__kicker">Gestion medica</span>
                <h1 className="module-header__title">Profesionales</h1>
                <p className="module-header__desc">
                    Equipo clinico, especialidades y disponibilidad.
                </p>
                <p className="module-header__meta">
                    {total} profesionales | {active} activos
                </p>
            </div>

            <div className="ops-module-head__stats">
                <article className="ops-module-metric">
                    <span className="ops-module-metric__label">Activos</span>
                    <strong className="ops-module-metric__value">{active}</strong>
                </article>
                <article className="ops-module-metric">
                    <span className="ops-module-metric__label">Especialidades</span>
                    <strong className="ops-module-metric__value">{specialties}</strong>
                </article>
                <article className="ops-module-metric">
                    <span className="ops-module-metric__label">Servicios</span>
                    <strong className="ops-module-metric__value">{assignedServices}</strong>
                </article>
            </div>

            <div className="module-header__actions ops-module-head__actions">
                <Button variant="primary" onClick={onNewProfesional} leftIcon={<Icon name="plus" size={16} />}>
                    Nuevo profesional
                </Button>
            </div>
        </header>
    );
}
