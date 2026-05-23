'use client';

import React, { useMemo } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { PatientDocument } from '@/lib/types';
import { PATIENT_DOCUMENT_STATUS_LABELS } from '@/lib/types';
import { sanitizeDocumentFormData } from '@/lib/patient-document-definitions';

interface PatientDocumentItemProps {
    document: PatientDocument;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    fieldLabels: Map<string, string>;
    onEdit: (document: PatientDocument) => void;
    onDelete: (id: string) => void;
}

function formatDocDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PatientDocumentItem({
    document,
    isExpanded,
    onToggle,
    fieldLabels,
    onEdit,
    onDelete,
}: PatientDocumentItemProps) {
    const entries = useMemo(
        () => Object.entries(sanitizeDocumentFormData(document.document_type, document.form_data)),
        [document.document_type, document.form_data]
    );

    return (
        <article className="patient-record-item">
            <div className="patient-record-item__head">
                <div>
                    <span>{formatDocDate(document.visit_date ?? document.created_at)}</span>
                    <small>Actualizado: {formatDocDate(document.updated_at)}</small>
                </div>
                <Badge
                    variant={
                        document.status === 'signed'
                            ? 'success'
                            : document.status === 'completed'
                                ? 'default'
                                : 'warning'
                    }
                >
                    {PATIENT_DOCUMENT_STATUS_LABELS[document.status]}
                </Badge>
            </div>

            <button
                type="button"
                className="patient-record-item__toggle"
                aria-expanded={isExpanded}
                onClick={() => onToggle(document.id)}
            >
                <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={13} />
                <span>
                    {isExpanded
                        ? 'Ocultar datos'
                        : `Ver datos${entries.length ? ` (${entries.length})` : ''}`}
                </span>
            </button>
            {isExpanded && (
                <div className="patient-record-item__content">
                    {entries.length === 0 ? (
                        <div>
                            <span>Campos del documento</span>
                            <p>Sin datos rellenados todavía.</p>
                        </div>
                    ) : (
                        entries.map(([key, value]) => (
                            <div key={key}>
                                <span>{fieldLabels.get(key) ?? key}</span>
                                <p>{typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value || '—')}</p>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="patient-clinical__actions">
                <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Icon name="edit" size={14} />}
                    onClick={() => onEdit(document)}
                >
                    Rellenar / editar
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    leftIcon={<Icon name="trash" size={13} />}
                    onClick={() => onDelete(document.id)}
                >
                    Eliminar
                </Button>
            </div>
        </article>
    );
}
