'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface ServiciosHeaderProps {
    servicesCount: number;
    categoriesCount: number;
    activeCount: number;
    avgPrice: number;
    onNewCategory: () => void;
    onNewService: () => void;
}

export function ServiciosHeader({
    servicesCount,
    categoriesCount,
    activeCount,
    avgPrice,
    onNewCategory,
    onNewService,
}: ServiciosHeaderProps) {
    const kpis = [
        { label: 'Servicios', value: servicesCount, tone: 'canela', icon: 'spa' },
        { label: 'Categorías', value: categoriesCount, tone: 'neutral', icon: 'folder' },
        { label: 'Activos', value: activeCount, tone: 'success', icon: 'check' },
        { label: 'Precio medio', value: `${Math.round(avgPrice)} €`, tone: 'warning', icon: 'scale' },
    ] as const;

    return (
        <header className="zs-svc-header">
            <div className="zs-svc-header__top">
                <div className="zs-svc-header__actions">
                    <Button variant="secondary" onClick={onNewCategory} leftIcon={<Icon name="folder" size={15} />}>
                        <span className="hidden sm:inline">Nueva categoría</span>
                        <span className="sm:hidden">Categoría</span>
                    </Button>
                    <Button variant="primary" onClick={onNewService} leftIcon={<Icon name="plus" size={15} />}>
                        Nuevo servicio
                    </Button>
                </div>
            </div>

            <div className="zs-svc-kpi-strip">
                {kpis.map((k) => (
                    <div key={k.label} className={`zs-svc-kpi zs-svc-kpi--${k.tone}`}>
                        <div className="zs-svc-kpi__top">
                            <p className="zs-svc-kpi__label">{k.label}</p>
                            <span className="zs-svc-kpi__icon"><Icon name={k.icon} size={16} /></span>
                        </div>
                        <p className="zs-svc-kpi__value">{k.value}</p>
                    </div>
                ))}
            </div>
        </header>
    );
}
