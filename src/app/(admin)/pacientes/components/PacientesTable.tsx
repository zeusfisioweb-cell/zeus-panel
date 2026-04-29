'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from '@/components/Icon';
import { Patient } from '@/lib/types';

function relativeDate(iso: string): string {
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
    } catch {
        return new Date(iso).toLocaleDateString('es-ES');
    }
}

interface PacientesTableProps {
    patients: Patient[];
    search: string;
    onSearchChange: (val: string) => void;
    onViewPatient: (p: Patient) => void;
    selectedPatientId?: string;
    page: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (newPage: number) => void;
}

export function PacientesTable({
    patients,
    search,
    onSearchChange,
    onViewPatient,
    selectedPatientId,
    page,
    pageSize,
    totalCount,
    onPageChange,
}: PacientesTableProps) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const searchInputId = 'patients-table-search';

    return (
        <div className="zs-pac-table-shell">
            {/* Search bar */}
            <div className="zs-pac-search-bar">
                <div className="zs-pac-search-bar__input-wrap">
                    <span className="zs-pac-search-bar__icon"><Icon name="search" size={15} /></span>
                    <label htmlFor={searchInputId} className="sr-only">
                        Buscar pacientes por nombre, apellido, documento o teléfono
                    </label>
                    <input
                        id={searchInputId}
                        name="patients_search"
                        autoComplete="off"
                        className="zs-pac-search-bar__input"
                        placeholder="Buscar por nombre, documento o teléfono"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <span className="zs-pac-search-bar__count" aria-live="polite">{totalCount} registrados</span>
            </div>

            {/* Table */}
            <div className="zs-pac-table-card">
                <div className="zs-pac-table-wrap">
                    <table className="zs-pac-table">
                        <caption className="sr-only">Listado de pacientes registrados</caption>
                        <thead>
                            <tr>
                                <th scope="col">Paciente</th>
                                <th scope="col">Contacto</th>
                                <th scope="col">Consentimiento</th>
                                <th scope="col">Alta</th>
                                <th scope="col" className="text-right">Ficha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map((patient) => (
                                <tr
                                    key={patient.id}
                                    className={`zs-pac-row ${selectedPatientId === patient.id ? 'is-selected' : ''}`}
                                >
                                    <td>
                                        <div className="zs-pac-row__ident">
                                            <div className="zs-pac-row__avatar" aria-hidden="true">
                                                {(patient.first_name?.[0] ?? '').toUpperCase()}{(patient.last_name?.[0] ?? '').toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="zs-pac-row__name">{patient.first_name} {patient.last_name}</div>
                                                <div className="zs-pac-row__doc">{patient.document_id || 'Sin documento'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="zs-pac-row__phone">{patient.phone || '—'}</div>
                                        <div className="zs-pac-row__email">{patient.email || '—'}</div>
                                    </td>
                                    <td>
                                        <span className={`zs-pac-consent ${patient.gdpr_consent ? 'zs-pac-consent--ok' : 'zs-pac-consent--pending'}`}>
                                            <span className="zs-pac-consent__dot" />
                                            {patient.gdpr_consent ? 'Aceptado' : 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="zs-pac-row__date" title={new Date(patient.created_at).toLocaleDateString('es-ES')}>
                                            {relativeDate(patient.created_at)}
                                        </div>
                                        <div className="zs-pac-row__date-abs">{new Date(patient.created_at).toLocaleDateString('es-ES')}</div>
                                    </td>
                                    <td className="text-right">
                                        <button
                                            className="zs-pac-ficha-btn"
                                            onClick={() => onViewPatient(patient)}
                                            aria-label={`Ver ficha de ${patient.first_name} ${patient.last_name}`}
                                        >
                                            Ver ficha
                                            <Icon name="chevron-right" size={13} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {patients.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="zs-pac-empty">
                                            <div className="zs-pac-empty__icon"><Icon name="users" size={24} /></div>
                                            <p className="zs-pac-empty__title">Sin resultados</p>
                                            <p className="zs-pac-empty__text">Sin pacientes para este filtro.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pill pagination */}
                <div className="zs-pac-pagination">
                    <span className="zs-pac-pagination__info">
                        Mostrando {patients.length} de {totalCount} pacientes
                    </span>
                    <div className="zs-pac-pagination__pills">
                        <button
                            className="zs-pac-pagination__pill"
                            disabled={page <= 1}
                            onClick={() => onPageChange(page - 1)}
                            aria-label="Página anterior"
                        >
                            <Icon name="chevron-left" size={14} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = page <= 3 ? i + 1 : page - 2 + i;
                            if (p < 1 || p > totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    className={`zs-pac-pagination__pill ${p === page ? 'is-active' : ''}`}
                                    onClick={() => onPageChange(p)}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            className="zs-pac-pagination__pill"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange(page + 1)}
                            aria-label="Página siguiente"
                        >
                            <Icon name="chevron-right" size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
