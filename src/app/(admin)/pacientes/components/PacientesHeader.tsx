'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface PacientesHeaderProps {
    totalCount: number;
    onNewPaciente: () => void;
}

export function PacientesHeader({ totalCount, onNewPaciente }: PacientesHeaderProps) {
    return (
        <header className="module-header module-header--pacientes ops-module-head">
            <div className="ops-module-head__intro">
                <span className="module-header__kicker">Gestion clinica</span>
                <h1 className="module-header__title">Pacientes</h1>
                <p className="module-header__desc">
                    Fichas y seguimiento clinico en un solo flujo.
                </p>
                <p className="module-header__meta">{totalCount} fichas registradas</p>
            </div>

            <div className="ops-module-head__stats">
                <article className="ops-module-metric">
                    <span className="ops-module-metric__label">Total</span>
                    <strong className="ops-module-metric__value">{totalCount}</strong>
                </article>
            </div>

            <div className="module-header__actions ops-module-head__actions">
                <Button variant="primary" onClick={onNewPaciente} leftIcon={<Icon name="plus" size={16} />}>
                    Nuevo paciente
                </Button>
            </div>
        </header>
    );
}
