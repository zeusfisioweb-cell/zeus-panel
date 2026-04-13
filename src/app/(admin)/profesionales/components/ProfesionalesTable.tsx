'use client';

import React, { useMemo, useState } from 'react';
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

type StatusFilter = 'all' | 'active' | 'inactive';

function getInitials(fullName?: string | null): string {
    if (!fullName) return 'PR';

    return fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function normalizeText(value?: string | null): string {
    return (value || '').trim().toLowerCase();
}

export function ProfesionalesTable({ professionals, onEdit, onDelete }: ProfesionalesTableProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const activeCount = professionals.filter((pro) => pro.is_active).length;
    const inactiveCount = professionals.length - activeCount;
    const filteredProfessionals = useMemo(() => {
        const query = normalizeText(search);

        return professionals
            .filter((pro) => {
                if (statusFilter === 'active' && !pro.is_active) return false;
                if (statusFilter === 'inactive' && pro.is_active) return false;

                if (!query) return true;

                const fullName = normalizeText(pro.profile?.full_name);
                const email = normalizeText(pro.profile?.email);
                const specialty = normalizeText(pro.specialty);

                return fullName.includes(query) || email.includes(query) || specialty.includes(query);
            })
            .slice()
            .sort((a, b) => {
                if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

                const nameA = normalizeText(a.profile?.full_name);
                const nameB = normalizeText(b.profile?.full_name);
                return nameA.localeCompare(nameB);
            });
    }, [professionals, search, statusFilter]);

    const filterButtonClass = (filter: StatusFilter) =>
        `btn btn--secondary btn--sm pro-filter-btn ${statusFilter === filter ? 'is-active' : ''}`;

    return (
        <div className="module-bento fade-in space-y-6 ops-data-module">
            <Card className="w-full ops-filter-card pro-filter-card shadow-sm border-[var(--ops-line)] rounded-[14px]">
                <CardContent className="pro-filter-card__body">
                    <div className="pro-filter-toolbar">
                        <div className="max-w-2xl">
                            <label className="form-label !mb-2.5">Buscar profesional</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                                    <Icon name="search" size={16} />
                                </span>
                                <input
                                    className="form-input !h-12 !pl-11 rounded-xl text-[15px]"
                                    placeholder="Nombre, email o especialidad"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pro-filter-switches">
                            <button type="button" className={filterButtonClass('all')} onClick={() => setStatusFilter('all')}>
                                Todos ({professionals.length})
                            </button>
                            <button type="button" className={filterButtonClass('active')} onClick={() => setStatusFilter('active')}>
                                Activos ({activeCount})
                            </button>
                            <button type="button" className={filterButtonClass('inactive')} onClick={() => setStatusFilter('inactive')}>
                                Inactivos ({inactiveCount})
                            </button>
                        </div>
                    </div>

                    <div className="pro-filter-summary">
                        <span className="pro-filter-summary__item">{filteredProfessionals.length} visibles</span>
                        <span className="pro-filter-summary__item">{activeCount} activos</span>
                    </div>
                </CardContent>
            </Card>

            {filteredProfessionals.length === 0 ? (
                <Card className="w-full ops-data-table-card rounded-[14px] border-[var(--ops-line)]">
                    <CardContent className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
                            <div className="h-16 w-16 bg-[var(--ops-surface-soft)] rounded-full flex items-center justify-center">
                                <Icon name="user" size={28} className="text-[var(--ops-text-subtle)]" />
                            </div>
                            <p className="text-[15px] font-extrabold text-[var(--text-main)] mt-2">Sin resultados</p>
                            <p className="text-sm font-medium">Ajusta la busqueda o el filtro para ver profesionales.</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProfessionals.map((pro) => {
                        const fullName = pro.profile?.full_name || 'Sin nombre';
                        const email = pro.profile?.email || 'Sin email';
                        const specialty = pro.specialty || 'General';
                        const serviceCount = pro.services?.length || 0;

                        return (
                            <article key={pro.id} className="bento-card pro-card p-6 flex flex-col gap-5 relative overflow-hidden group transition-all">
                                <div className="flex items-start justify-between gap-4 relative z-10">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div
                                            className="h-12 w-12 rounded-[12px] border-2 flex items-center justify-center text-[15px] font-extrabold shrink-0 shadow-sm"
                                            style={{
                                                background: pro.color_code ? `${pro.color_code}15` : 'var(--bg-active)',
                                                borderColor: pro.color_code ? `${pro.color_code}40` : 'var(--border-color)',
                                                color: pro.color_code || 'var(--text-main)',
                                            }}
                                        >
                                            {getInitials(fullName)}
                                        </div>

                                        <div className="min-w-0">
                                            <h3 className="text-lg leading-tight font-extrabold text-[var(--text-main)] truncate" title={fullName}>
                                                {fullName}
                                            </h3>
                                            <p className="text-sm text-[var(--text-muted)] truncate font-semibold" title={email}>
                                                {email}
                                            </p>
                                        </div>
                                    </div>

                                    <Badge variant={pro.is_active ? 'success' : 'default'} className="shadow-sm">
                                        {pro.is_active ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </div>

                                <div className="relative z-10 pro-card__meta-block mt-1 space-y-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--ops-text-subtle)] font-bold mb-0.5">Especialidad</p>
                                        <p className="text-sm font-bold text-[var(--ops-text)] truncate pr-2" title={specialty}>
                                            {specialty}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--ops-text)]">
                                        <Icon name="briefcase" size={14} className="text-[var(--ops-accent)]" />
                                        {serviceCount} servicios asignados
                                    </div>
                                </div>

                                {pro.bio ? (
                                    <p className="text-xs text-[var(--ops-text-muted)] leading-relaxed relative z-10 flex-1 mt-1 font-medium" title={pro.bio}>
                                        {pro.bio.length > 88 ? `${pro.bio.slice(0, 88)}...` : pro.bio}
                                    </p>
                                ) : (
                                    <div className="flex-1" />
                                )}

                                <div className="mt-auto pt-4 flex gap-2 relative z-10 border-t border-[var(--ops-line)]">
                                    <Button
                                        variant="secondary"
                                        className="flex-1 h-9 text-xs font-bold shadow-sm pro-card__action-btn"
                                        onClick={() => onEdit(pro)}
                                        title="Editar perfil"
                                    >
                                        <Icon name="settings" size={14} className="mr-1.5" />
                                        Editar
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-transparent"
                                        onClick={() => onDelete(pro.id)}
                                        title="Eliminar profesional"
                                    >
                                        <Icon name="trash" size={16} />
                                    </Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
