'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface ServiciosHeaderProps {
    servicesCount: number;
    categoriesCount: number;
    onNewCategory: () => void;
    onNewService: () => void;
}

export function ServiciosHeader({
    servicesCount,
    categoriesCount,
    onNewCategory,
    onNewService,
}: ServiciosHeaderProps) {
    return (
        <header className="module-header module-header--servicios ops-module-head">
            <div className="ops-module-head__intro">
                <span className="module-header__kicker">Catalogo</span>
                <h1 className="module-header__title">Servicios</h1>
                <p className="module-header__desc">
                    Catalogo de tratamientos, duracion y precio.
                </p>
                <p className="module-header__meta">
                    {servicesCount} servicios | {categoriesCount} categorias
                </p>
            </div>

            <div className="ops-module-head__stats">
                <article className="ops-module-metric">
                    <span className="ops-module-metric__label">Servicios</span>
                    <strong className="ops-module-metric__value">{servicesCount}</strong>
                </article>
                <article className="ops-module-metric">
                    <span className="ops-module-metric__label">Categorias</span>
                    <strong className="ops-module-metric__value">{categoriesCount}</strong>
                </article>
            </div>

            <div className="module-header__actions ops-module-head__actions">
                <Button variant="secondary" onClick={onNewCategory} leftIcon={<Icon name="folder" size={16} />}>
                    Nueva categoria
                </Button>
                <Button variant="primary" onClick={onNewService} leftIcon={<Icon name="plus" size={16} />}>
                    Nuevo servicio
                </Button>
            </div>
        </header>
    );
}
