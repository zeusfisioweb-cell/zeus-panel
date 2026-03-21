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
        <header className="module-header module-header--servicios">
            <div>
                <span className="module-header__kicker">Catalogo</span>
                <h1 className="module-header__title">Servicios</h1>
                <p className="module-header__desc">
                    {servicesCount} servicios distribuidos en {categoriesCount} categorias.
                </p>
                <p className="module-header__meta">
                    Estandariza duraciones, precios y disponibilidad comercial.
                </p>
            </div>
            <div className="module-header__actions">
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
