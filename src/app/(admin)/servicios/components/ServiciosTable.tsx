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
    const grouped = categories.map(cat => ({
        category: cat,
        services: services.filter(s => s.category_id === cat.id),
    }));

    if (grouped.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state__icon"><Icon name="folder" size={24} /></div>
                <div className="empty-state__title">No hay categorías</div>
                <div className="empty-state__text">Crea una categoría para empezar a añadir servicios.</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {grouped.map(({ category, services: catServices }) => (
                <Card key={category.id}>
                    <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-[var(--border-color)]">
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        <Badge variant="default">
                            {catServices.length} servicios
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="table-wrapper">
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th>Servicio</th>
                                        <th>Duración / Precio</th>
                                        <th>Estado</th>
                                        <th className="text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {catServices.map(s => (
                                        <tr key={s.id} className="border-b last:border-0 border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
                                            <td>
                                                <div className="font-semibold text-[var(--text-main)] text-sm">{s.name}</div>
                                                {s.description && (
                                                    <div className="text-[13px] text-[var(--text-muted)] mt-1 max-w-[28rem] truncate">
                                                        {s.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="text-[var(--text-main)] font-medium">{Number(s.price).toFixed(0)}€</div>
                                                <div className="text-[var(--text-muted)] text-xs">{s.duration_minutes} min</div>
                                            </td>
                                            <td>
                                                <Badge variant={s.is_active ? 'success' : 'default'}>
                                                    {s.is_active ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => onEdit(s)} aria-label="Editar">
                                                        <Icon name="edit" size={14} />
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => onDelete(s.id)}
                                                        aria-label="Eliminar"
                                                    >
                                                        <Icon name="trash" size={14} />
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {catServices.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center bg-[var(--bg-hover)] rounded-b-xl">
                                                <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                                                    <div className="mb-2 opacity-50"><Icon name="spa" size={20} /></div>
                                                    <span className="text-sm font-medium">Sin servicios</span>
                                                    <span className="text-xs mt-1">No hay servicios en {category.name}</span>
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
