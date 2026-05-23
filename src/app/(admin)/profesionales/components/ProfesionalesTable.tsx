'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import type { Professional } from '@/lib/types';

interface ProfesionalesTableProps {
    professionals: Professional[];
    onEdit: (pro: Professional) => void;
    onDelete: (id: string) => void;
    onResendWelcome: (pro: Professional) => void;
    resendingId?: string | null;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const FILTER_OPTIONS: { key: StatusFilter; label: (counts: { all: number; active: number; inactive: number }) => string }[] = [
    { key: 'all', label: (c) => `Todos (${c.all})` },
    { key: 'active', label: (c) => `Activos (${c.active})` },
    { key: 'inactive', label: (c) => `Inactivos (${c.inactive})` },
];

function getInitials(fullName?: string | null): string {
    if (!fullName) return 'PR';
    return fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function normalizeText(value?: string | null): string {
    return (value || '').trim().toLowerCase();
}

export function ProfesionalesTable({ professionals, onEdit, onDelete, onResendWelcome, resendingId }: ProfesionalesTableProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const activeCount = professionals.filter((p) => p.is_active).length;
    const inactiveCount = professionals.length - activeCount;
    const counts = { all: professionals.length, active: activeCount, inactive: inactiveCount };

    const filtered = useMemo(() => {
        const q = normalizeText(search);
        return professionals
            .filter((pro) => {
                if (statusFilter === 'active' && !pro.is_active) return false;
                if (statusFilter === 'inactive' && pro.is_active) return false;
                if (!q) return true;
                return (
                    normalizeText(pro.profile?.full_name).includes(q) ||
                    normalizeText(pro.profile?.email).includes(q) ||
                    normalizeText(pro.specialty).includes(q)
                );
            })
            .slice()
            .sort((a, b) => {
                if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
                return normalizeText(a.profile?.full_name).localeCompare(normalizeText(b.profile?.full_name));
            });
    }, [professionals, search, statusFilter]);

    return (
        <div className="zs-pros-body">
            {/* Toolbar */}
            <div className="zs-pros-toolbar">
                <div className="zs-pros-search">
                    <span className="zs-pros-search__icon" aria-hidden="true"><Icon name="search" size={15} /></span>
                    <label htmlFor="pros-search" className="zs-sr-only">Buscar profesional por nombre, email o especialidad</label>
                    <input
                        id="pros-search"
                        className="zs-pros-search__input"
                        placeholder="Nombre, email o especialidad"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="zs-segment zs-pros-segment" role="group" aria-label="Filtrar profesionales por estado">
                    {FILTER_OPTIONS.map((opt) => (
                        <button
                            key={opt.key}
                            type="button"
                            aria-pressed={statusFilter === opt.key}
                            className={`zs-segment__btn ${statusFilter === opt.key ? 'is-active' : ''}`}
                            onClick={() => setStatusFilter(opt.key)}
                        >
                            {opt.label(counts)}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="zs-pros-empty">
                    <div className="zs-pros-empty__icon"><Icon name="user" size={28} /></div>
                    <p className="zs-pros-empty__title">Sin resultados</p>
                    <p className="zs-pros-empty__text">Ajusta la búsqueda o el filtro.</p>
                </div>
            ) : (
                <div className="zs-pros-grid">
                    {filtered.map((pro) => {
                        const fullName = pro.profile?.full_name || 'Sin nombre';
                        const email = pro.profile?.email || 'Sin email';
                        const specialty = pro.specialty || 'General';
                        const services = pro.services || [];
                        const color = pro.color_code || 'var(--brand-canela)';

                        return (
                            <article
                                key={pro.id}
                                className="zs-pro-card"
                                style={{ '--pro-color': color } as React.CSSProperties}
                            >
                                {/* ── Hero zone: dark section ── */}
                                <div className="zs-pro-card__hero">
                                    {/* Badge flotante */}
                                    <div className={`zs-pro-badge ${pro.is_active ? 'zs-pro-badge--active' : 'zs-pro-badge--inactive'}`}>
                                        <span className="zs-pro-badge__dot" />
                                        {pro.is_active ? 'Activo' : 'Inactivo'}
                                    </div>

                                    {/* Avatar grande circular */}
                                    <div className="zs-pro-avatar">
                                        <span className="zs-pro-avatar__initials">{getInitials(fullName)}</span>
                                    </div>

                                    {/* Nombre + email sobre fondo oscuro */}
                                    <div className="zs-pro-card__identity">
                                        <h3 className="zs-pro-card__name" title={fullName}>{fullName}</h3>
                                        <p className="zs-pro-card__email" title={email}>{email}</p>
                                    </div>
                                </div>

                                {/* ── Body zone: light section ── */}
                                <div className="zs-pro-card__body">
                                    <div className="zs-pro-card__specialty">
                                        <span className="zs-pro-card__specialty-label">Especialidad</span>
                                        <span className="zs-pro-card__specialty-value" title={specialty}>{specialty}</span>
                                    </div>

                                    {/* Service chips */}
                                    <div className="zs-pro-services">
                                        {services.length > 0 ? (
                                            services.slice(0, 4).map((svc) => (
                                                <span key={svc.id} className="zs-pro-chip">{svc.name}</span>
                                            ))
                                        ) : (
                                            <span className="zs-pro-chip zs-pro-chip--empty">Sin servicios asignados</span>
                                        )}
                                        {services.length > 4 && (
                                            <span className="zs-pro-chip zs-pro-chip--more">+{services.length - 4}</span>
                                        )}
                                    </div>

                                    {pro.bio && (
                                        <p className="zs-pro-card__bio">
                                            {pro.bio.length > 90 ? `${pro.bio.slice(0, 90)}…` : pro.bio}
                                        </p>
                                    )}

                                    <div className="zs-pro-card__actions">
                                        <Button
                                            variant="secondary"
                                            className="flex-1 h-9 text-xs font-bold"
                                            onClick={() => onEdit(pro)}
                                        >
                                            <Icon name="settings" size={13} className="mr-1.5" />
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-9 w-9 p-0 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                                            onClick={() => onResendWelcome(pro)}
                                            disabled={resendingId === pro.id}
                                            title="Reenviar email de acceso"
                                            aria-label="Reenviar email de acceso"
                                        >
                                            <Icon name="mail" size={15} className={resendingId === pro.id ? 'animate-pulse' : ''} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-9 w-9 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={() => onDelete(pro.id)}
                                            title="Eliminar"
                                        >
                                            <Icon name="trash" size={15} />
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
