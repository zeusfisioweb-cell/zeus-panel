'use client';

import React from 'react';
import { Service, ServiceCategory } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/Icon';

interface ServiciosTableProps {
    categories: ServiceCategory[];
    services: Service[];
    onEdit: (service: Service) => void;
    onDelete: (id: string) => void;
}

const CATEGORY_ACCENTS = [
    '#AD7332', // canela  — Fisioterapia
    '#7C3AED', // purple  — Psicología
    '#059669', // green
    '#2563EB', // blue
    '#D97706', // amber
    '#0F766E', // teal
];

export function ServiciosTable({ categories, services, onEdit, onDelete }: ServiciosTableProps) {
    const grouped = categories.map((cat, i) => ({
        category: cat,
        services: services.filter((s) => s.category_id === cat.id),
        accent: CATEGORY_ACCENTS[i % CATEGORY_ACCENTS.length],
    }));

    if (grouped.length === 0) {
        return (
            <div className="zs-svc-empty">
                <div className="zs-svc-empty__icon"><Icon name="folder" size={28} /></div>
                <p className="zs-svc-empty__title">No hay categorías</p>
                <p className="zs-svc-empty__text">Crea una categoría para empezar.</p>
            </div>
        );
    }

    return (
        <div className="zs-svc-catalog">
            {grouped.map(({ category, services: catSvcs, accent }) => (
                <section
                    key={category.id}
                    className="zs-svc-section"
                    style={{ '--zs-cat-color': accent } as React.CSSProperties}
                >
                    <div className="zs-svc-section__head">
                        <h2 className="zs-svc-section__name">{category.name}</h2>
                        <span className="zs-svc-section__count">
                            {catSvcs.length} {catSvcs.length === 1 ? 'servicio' : 'servicios'}
                        </span>
                    </div>

                    {catSvcs.length === 0 ? (
                        <div className="zs-svc-section__empty">
                            <Icon name="spa" size={16} />
                            <span>Sin servicios en esta categoría</span>
                        </div>
                    ) : (
                        <div className="zs-svc-grid">
                            {catSvcs.map((svc) => (
                                <article key={svc.id} className="zs-svc-tile">
                                    {/* Badge (izq) + Precio hero (der) */}
                                    <div className="zs-svc-tile__toprow">
                                        <span className={`zs-svc-tile__badge ${svc.is_active ? 'zs-svc-tile__badge--active' : 'zs-svc-tile__badge--inactive'}`}>
                                            {svc.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                        <span className="zs-svc-tile__price">
                                            {Number(svc.price).toFixed(0)}
                                            <span className="zs-svc-tile__currency"> EUR</span>
                                        </span>
                                    </div>

                                    <h3 className="zs-svc-tile__name">{svc.name}</h3>

                                    {svc.description && (
                                        <p className="zs-svc-tile__desc">{svc.description}</p>
                                    )}

                                    <div className="zs-svc-tile__footer">
                                        <span className="zs-svc-tile__duration">
                                            <Icon name="clock" size={11} />
                                            {svc.duration_minutes} min
                                        </span>
                                        <div className="zs-svc-tile__actions">
                                            <Button variant="ghost" size="sm" onClick={() => onEdit(svc)} aria-label={`Editar ${svc.name}`}>
                                                <Icon name="edit" size={13} />
                                                Editar
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => onDelete(svc.id)}
                                                aria-label={`Eliminar ${svc.name}`}
                                            >
                                                <Icon name="trash" size={13} />
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
