'use client';

import React from 'react';
import { Service, ServiceCategory } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Icon from '@/components/Icon';

interface ServiciosTableProps {
    categories: ServiceCategory[];
    services: Service[];
    onEdit: (service: Service) => void;
    onDelete: (id: string) => void;
}

export function ServiciosTable({ categories, services, onEdit, onDelete }: ServiciosTableProps) {
    const grouped = categories.map((category) => ({
        category,
        services: services.filter((service) => service.category_id === category.id),
    }));

    if (grouped.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state__icon"><Icon name="folder" size={24} /></div>
                <div className="empty-state__title">No hay categorias</div>
                <div className="empty-state__text">Crea una categoria para empezar.</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 ops-data-module">
            {grouped.map(({ category, services: categoryServices }) => (
                <Card key={category.id} className="ops-data-table-card">
                    <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-[var(--border-color)]">
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        <Badge variant="default">{categoryServices.length} servicios</Badge>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="table-wrapper">
                            <table className="table w-full servicios-table">
                                <caption className="sr-only">Servicios de la categoria {category.name}</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Servicio</th>
                                        <th scope="col">Precio y duracion</th>
                                        <th scope="col">Estado</th>
                                        <th scope="col" className="text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="servicios-table__body">
                                    {categoryServices.map((service) => (
                                        <tr
                                            key={service.id}
                                            className="border-b last:border-0 border-[var(--border-color)] hover:bg-[var(--bg-hover)] servicios-table__row"
                                        >
                                            <td>
                                                <div className="font-semibold text-[var(--text-main)] text-sm">{service.name}</div>
                                                {service.description && (
                                                    <div className="text-[13px] text-[var(--text-muted)] mt-1 max-w-[28rem] truncate">
                                                        {service.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="text-[var(--text-main)] font-medium">{Number(service.price).toFixed(0)} EUR</div>
                                                <div className="text-[var(--text-muted)] text-xs">{service.duration_minutes} min</div>
                                            </td>
                                            <td>
                                                <Badge variant={service.is_active ? 'success' : 'default'}>
                                                    {service.is_active ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => onEdit(service)} aria-label="Editar servicio">
                                                        <Icon name="edit" size={14} />
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="servicios-table__danger"
                                                        onClick={() => onDelete(service.id)}
                                                        aria-label="Eliminar servicio"
                                                    >
                                                        <Icon name="trash" size={14} />
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {categoryServices.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center bg-[var(--bg-hover)] rounded-b-xl">
                                                <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                                                    <div className="mb-2 opacity-50"><Icon name="spa" size={20} /></div>
                                                    <span className="text-sm font-medium">Sin servicios</span>
                                                    <span className="text-xs mt-1">Sin servicios en esta categoria.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
