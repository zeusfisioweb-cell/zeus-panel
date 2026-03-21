'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Professional } from '@/lib/types';

interface ProfesionalesTableProps {
    professionals: Professional[];
    onEdit: (pro: Professional) => void;
    onDelete: (id: string) => void;
}

export function ProfesionalesTable({ professionals, onEdit, onDelete }: ProfesionalesTableProps) {
    return (
        <div className="module-bento fade-in">
            <Card className="w-full">
                <CardContent className="p-0">
                    <div className="table-wrapper">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Perfil</th>
                                    <th>Especialidad</th>
                                    <th>Estado</th>
                                    <th className="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {professionals.map(p => (
                                    <tr key={p.id} className="border-b last:border-0 border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
                                        <td className="w-1/3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                                                    style={{
                                                        background: p.color_code ? `${p.color_code}22` : 'var(--bg-active)',
                                                        borderColor: p.color_code ? `${p.color_code}55` : 'var(--border-color)',
                                                        borderWidth: '1px',
                                                        color: p.color_code || 'var(--text-main)',
                                                    }}
                                                >
                                                    {p.profile?.full_name ? (
                                                        p.profile.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                                                    ) : '?'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[var(--text-main)] text-sm">{p.profile?.full_name || 'Sin nombre'}</div>
                                                    <div className="text-xs text-[var(--text-muted)]">{p.profile?.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-[var(--text-main)] text-sm font-medium">{p.specialty || 'General'}</div>
                                            {p.bio && <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]" title={p.bio}>{p.bio}</div>}
                                            <div className="text-xs text-[var(--text-light)] mt-1">
                                                {(p.services?.length || 0)} servicios asignados
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={p.is_active ? 'success' : 'default'}>
                                                {p.is_active ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => onEdit(p)} title="Editar perfil">
                                                    <Icon name="settings" size={14} />
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => onDelete(p.id)}
                                                    title="Eliminar profesional"
                                                >
                                                    <Icon name="trash" size={14} />
                                                    Eliminar
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {professionals.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center bg-[var(--bg-hover)] rounded-b-xl">
                                            <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                                                <Icon name="user" size={24} className="mb-2 opacity-50" />
                                                <span className="text-sm font-medium">Sin profesionales</span>
                                                <span className="text-xs mt-1">Agrega a tu equipo para comenzar a gestionar sus horarios.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
