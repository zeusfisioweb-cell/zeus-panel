'use client';

import React from 'react';
import Icon from '@/components/Icon';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Patient } from '@/lib/types';

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
        <div className="pacientes-table-shell ops-data-module">
            <Card className="ops-filter-card">
                <CardContent>
                    <div className="filter-bar pacientes-filter-bar">
                        <div className="filter-bar__search">
                            <label htmlFor={searchInputId} className="sr-only">
                                Buscar pacientes por nombre, apellido o documento
                            </label>
                            <span className="filter-bar__search-icon">
                                <Icon name="search" size={16} />
                            </span>
                            <input
                                id={searchInputId}
                                name="patients_search"
                                autoComplete="off"
                                className="form-input"
                                placeholder="Buscar por nombre o documento"
                                value={search}
                                onChange={(event) => onSearchChange(event.target.value)}
                            />
                        </div>
                        <div className="filter-bar__count" aria-live="polite">
                            {totalCount} registrados
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden flex flex-col ops-data-table-card">
                <CardContent className="p-0 flex-1 overflow-auto">
                    <div className="table-wrapper">
                        <table className="table w-full pacientes-table">
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

                            <tbody className="pacientes-table__body">
                                {patients.map((patient) => (
                                    <tr
                                        key={patient.id}
                                        onClick={() => onViewPatient(patient)}
                                        className={`cursor-pointer transition-colors pacientes-table__row ${
                                            selectedPatientId === patient.id ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                                        }`}
                                    >
                                        <td>
                                            <div className="pacientes-table__name" title={`${patient.first_name} ${patient.last_name}`}>
                                                {patient.first_name} {patient.last_name}
                                            </div>
                                            <div className="pacientes-table__meta" title={patient.document_id || 'Sin documento'}>
                                                Documento: {patient.document_id || 'Sin documento'}
                                            </div>
                                        </td>

                                        <td>
                                            <div className="pacientes-table__phone" title={patient.phone || 'Sin teléfono'}>
                                                {patient.phone || 'Sin teléfono'}
                                            </div>
                                            <div className="pacientes-table__email" title={patient.email || 'Sin email'}>
                                                {patient.email || 'Sin email'}
                                            </div>
                                        </td>

                                        <td>
                                            <Badge variant={patient.gdpr_consent ? 'success' : 'default'}>
                                                {patient.gdpr_consent ? 'Aceptado' : 'Pendiente'}
                                            </Badge>
                                        </td>

                                        <td className="text-sm text-[var(--text-muted)]">
                                            {new Date(patient.created_at).toLocaleDateString('es-ES')}
                                        </td>

                                        <td className="text-right">
                                            <button
                                                className="btn btn--secondary btn--sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onViewPatient(patient);
                                                }}
                                            >
                                                Ver ficha
                                                <Icon name="chevron-right" size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {patients.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center bg-[var(--bg-hover)]">
                                            <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                                                <div className="mb-2 opacity-50">
                                                    <Icon name="users" size={24} />
                                                </div>
                                                <span className="text-sm font-medium">Sin resultados</span>
                                                <span className="text-xs mt-1">Sin pacientes para este filtro.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>

                <div className="p-3 border-t border-[var(--border-color)] flex items-center justify-between text-sm flex-wrap gap-2 pacientes-table__footer">
                    <span className="text-[var(--text-muted)]">
                        Mostrando {patients.length} de {totalCount} pacientes
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn--secondary btn--sm"
                            disabled={page <= 1}
                            onClick={() => onPageChange(page - 1)}
                        >
                            Anterior
                        </button>

                        <span className="px-2 text-[var(--text-main)] font-medium">
                            Página {page} de {totalPages}
                        </span>

                        <button
                            className="btn btn--secondary btn--sm"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange(page + 1)}
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
