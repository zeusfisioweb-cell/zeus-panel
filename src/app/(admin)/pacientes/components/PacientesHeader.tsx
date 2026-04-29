'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface PacientesHeaderProps {
    totalCount: number;
    consentCount: number;
    onNewPaciente: () => void;
}

export function PacientesHeader({ totalCount, consentCount, onNewPaciente }: PacientesHeaderProps) {
    const consentPct = totalCount > 0 ? Math.round((consentCount / totalCount) * 100) : 0;
    const pendingConsent = totalCount - consentCount;

    return (
        <header className="zs-pac-header">
            <div className="zs-pac-header__top">
                <div className="zs-pac-header__actions">
                    <Button variant="primary" onClick={onNewPaciente} leftIcon={<Icon name="plus" size={16} />}>
                        Nuevo paciente
                    </Button>
                </div>
            </div>

            <div className="zs-pac-kpi-strip">
                <div className="zs-pac-kpi zs-pac-kpi--neutral">
                    <div className="zs-pac-kpi__top">
                        <p className="zs-pac-kpi__label">Total pacientes</p>
                        <span className="zs-pac-kpi__icon"><Icon name="users" size={16} /></span>
                    </div>
                    <p className="zs-pac-kpi__value">{totalCount}</p>
                </div>
                <div className="zs-pac-kpi zs-pac-kpi--success">
                    <div className="zs-pac-kpi__top">
                        <p className="zs-pac-kpi__label">RGPD aceptado</p>
                        <span className="zs-pac-kpi__icon"><Icon name="check" size={16} /></span>
                    </div>
                    <p className="zs-pac-kpi__value">{consentCount}</p>
                </div>
                <div className={`zs-pac-kpi ${pendingConsent > 0 ? 'zs-pac-kpi--warning' : 'zs-pac-kpi--success'}`}>
                    <div className="zs-pac-kpi__top">
                        <p className="zs-pac-kpi__label">Pendiente</p>
                        <span className="zs-pac-kpi__icon"><Icon name="warning" size={16} /></span>
                    </div>
                    <p className="zs-pac-kpi__value">{pendingConsent}</p>
                </div>
                <div className="zs-pac-kpi zs-pac-kpi--canela">
                    <div className="zs-pac-kpi__top">
                        <p className="zs-pac-kpi__label">Ratio Legal</p>
                        <span className="zs-pac-kpi__icon"><Icon name="chart" size={16} /></span>
                    </div>
                    <p className="zs-pac-kpi__value">{consentPct}%</p>
                </div>
            </div>
        </header>
    );
}
