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
        <header className="module-header module-header--pacientes">
            <div>
                <span className="module-header__kicker">Gestion clinica</span>
                <h1 className="module-header__title">Pacientes</h1>
                <p className="module-header__desc">
                    Historial, contacto y seguimiento clinico en un solo lugar.
                </p>
                <p className="module-header__meta">{totalCount} registros activos con ficha editable</p>
            </div>
            <div className="module-header__actions">
                <Button variant="primary" onClick={onNewPaciente} leftIcon={<Icon name="plus" size={16} />}>
                    Nuevo paciente
                </Button>
            </div>
        </header>
    );
}
