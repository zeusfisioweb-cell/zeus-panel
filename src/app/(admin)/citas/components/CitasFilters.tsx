'use client';

import React from 'react';
import Icon from '@/components/Icon';

interface CitasFiltersProps {
    searchTerm: string;
    onSearchChange: (val: string) => void;
    filter: string;
    onFilterChange: (val: string) => void;
    dateFilter: string;
    onDateFilterChange: (val: string) => void;
    totalCount: number;
}

export function CitasFilters({
    searchTerm,
    onSearchChange,
    filter,
    onFilterChange,
    dateFilter,
    onDateFilterChange,
    totalCount,
}: CitasFiltersProps) {
    const searchId = 'citas-filter-search';
    const statusId = 'citas-filter-status';
    const dateId = 'citas-filter-date';

    return (
        <div className="citas-filters ops-filter-panel">
            <div className="citas-filters__row">
                <div className="citas-filters__search">
                    <label htmlFor={searchId} className="sr-only">
                        Buscar paciente por nombre o DNI
                    </label>
                    <span className="citas-filters__search-icon">
                        <Icon name="search" size={18} />
                    </span>
                    <input
                        id={searchId}
                        type="text"
                        className="form-input citas-filters__search-input"
                        placeholder="Buscar paciente o documento..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                <div className="citas-filters__field">
                    <label htmlFor={statusId} className="sr-only">
                        Filtrar citas por estado
                    </label>
                    <Icon name="filter" size={16} />
                    <select
                        id={statusId}
                        className="citas-filters__select"
                        value={filter}
                        onChange={(e) => onFilterChange(e.target.value)}
                    >
                        <option value="all">Todas las citas</option>
                        <option value="upcoming">Proximas</option>
                        <option value="confirmed">Confirmadas</option>
                        <option value="completed">Completadas</option>
                        <option value="cancelled">Canceladas</option>
                    </select>
                </div>

                <div className="citas-filters__field citas-filters__field--date">
                    <label htmlFor={dateId} className="sr-only">
                        Filtrar citas por fecha
                    </label>
                    <Icon name="calendar" size={16} />
                    <input
                        id={dateId}
                        type="date"
                        className="citas-filters__date"
                        value={dateFilter}
                        onChange={(e) => onDateFilterChange(e.target.value)}
                    />
                    {dateFilter && (
                        <button
                            type="button"
                            className="citas-filters__clear"
                            onClick={() => onDateFilterChange('')}
                            title="Limpiar fecha"
                            aria-label="Limpiar fecha"
                        >
                            <Icon name="x" size={12} />
                        </button>
                    )}
                </div>
            </div>

            <div className="citas-filters__total ops-filter-panel__meta">
                <strong>{totalCount}</strong> resultados
            </div>
        </div>
    );
}
