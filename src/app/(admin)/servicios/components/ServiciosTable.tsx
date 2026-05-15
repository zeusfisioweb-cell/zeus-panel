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
    '#6366F1',
    '#0EA5E9',
    '#10B981',
    '#F59E0B',
    '#EC4899',
    '#8B5CF6',
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
                                <article key={svc.id} className="zs-svc-card">

                                    {/* Main body */}
                                    <div className="zs-svc-card__body">
                                        <h3 className="zs-svc-card__name">{svc.name}</h3>

                                        {svc.description ? (
                                            <p className="zs-svc-card__desc">{svc.description}</p>
                                        ) : (
                                            <div className="zs-svc-card__desc-placeholder" />
                                        )}

                                        <div className="zs-svc-card__meta">
                                            <span className="zs-svc-card__duration">
                                                <Icon name="clock" size={11} />
                                                {svc.duration_minutes} min
                                            </span>
                                            <span className="zs-svc-card__price">
                                                {Number(svc.price).toFixed(0)}
                                                <span className="zs-svc-card__currency"> €</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="zs-svc-card__footer">
                                        <span className={`zs-svc-card__status ${svc.is_active ? 'is-active' : 'is-inactive'}`}>
                                            <span className="zs-svc-card__status-dot" />
                                            {svc.is_active ? 'Activo' : 'Inactivo'}
                                        </span>

                                        <div className="zs-svc-card__actions">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEdit(svc)}
                                                aria-label={`Editar ${svc.name}`}
                                            >
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
