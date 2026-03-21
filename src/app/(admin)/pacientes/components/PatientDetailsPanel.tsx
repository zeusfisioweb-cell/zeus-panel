'use client';

import React, { useState } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Patient, Appointment, ClinicalRecord, RecordType } from '@/lib/types';
import { RECORD_TYPE_LABELS, RECORD_TYPE_COLORS, STATUS_LABELS } from '@/lib/types';

type DetailTab = 'datos' | 'citas' | 'clinico';

interface PatientDetailsPanelProps {
    patient: Patient;
    appointments: Appointment[];
    records: ClinicalRecord[];
    onClose: () => void;
    onEdit: () => void;
    onDelete: (id: string) => void;
    onNewRecord: (type: RecordType) => void;
    onDeleteRecord: (id: string) => void;
}

export function PatientDetailsPanel({
    patient,
    appointments,
    records,
    onClose,
    onEdit,
    onDelete,
    onNewRecord,
    onDeleteRecord,
}: PatientDetailsPanelProps) {
    const [activeTab, setActiveTab] = useState<DetailTab>('datos');

    const renderDatos = () => (
        <div className="patient-detail-grid">
            <div className="patient-detail-item">
                <span>Telefono</span>
                <strong>{patient.phone || '—'}</strong>
            </div>
            <div className="patient-detail-item">
                <span>Email</span>
                <strong>{patient.email || '—'}</strong>
            </div>
            <div className="patient-detail-item">
                <span>Documento (DNI/NIE)</span>
                <strong>{patient.document_id || '—'}</strong>
            </div>
            <div className="patient-detail-item">
                <span>Fecha nacimiento</span>
                <strong>{patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('es-ES') : '—'}</strong>
            </div>
            <div className="patient-detail-item patient-detail-item--full">
                <span>Direccion</span>
                <strong>{patient.address || '—'}</strong>
            </div>
            <div className="patient-detail-item">
                <span>RGPD</span>
                <Badge variant={patient.gdpr_consent ? 'success' : 'default'}>
                    {patient.gdpr_consent ? 'Aceptado' : 'Pendiente'}
                </Badge>
            </div>
            <div className="patient-detail-item">
                <span>Marketing</span>
                <Badge variant={patient.marketing_consent ? 'success' : 'default'}>
                    {patient.marketing_consent ? 'Si' : 'No'}
                </Badge>
            </div>

            <div className="patient-detail-danger">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(patient.id)}
                    leftIcon={<Icon name="trash" size={14} />}
                >
                    Eliminar permanentemente
                </Button>
                <p>
                    Cumplimiento RGPD: esta accion borra los datos identificables del paciente.
                </p>
            </div>
        </div>
    );

    const renderCitas = () => {
        if (appointments.length === 0) {
            return (
                <div className="patient-empty-box">
                    <Icon name="calendar" size={22} className="opacity-50" />
                    <p>Sin citas registradas</p>
                </div>
            );
        }

        return (
            <div className="patient-citas-list">
                {appointments.map((appointment) => (
                    <article key={appointment.id} className="patient-cita-item">
                        <div className="patient-cita-item__top">
                            <strong>{appointment.service?.name || 'Servicio general'}</strong>
                            <span>
                                {new Date(appointment.start_time).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                })}
                            </span>
                        </div>
                        <div className="patient-cita-item__meta">
                            {new Date(appointment.start_time).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                        <Badge variant={appointment.status as 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'}>
                            {STATUS_LABELS[appointment.status] || appointment.status}
                        </Badge>
                    </article>
                ))}
            </div>
        );
    };

    const renderClinico = () => (
        <div className="patient-clinical">
            <div className="patient-clinical__actions">
                {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((type) => (
                    <button
                        key={type}
                        className="patient-record-add"
                        style={{
                            borderColor: RECORD_TYPE_COLORS[type],
                            color: RECORD_TYPE_COLORS[type],
                            backgroundColor: `${RECORD_TYPE_COLORS[type]}1A`,
                        }}
                        onClick={() => onNewRecord(type)}
                    >
                        <Icon name="plus" size={12} />
                        {RECORD_TYPE_LABELS[type]}
                    </button>
                ))}
            </div>

            {records.length === 0 ? (
                <div className="patient-empty-box">
                    <Icon name="clipboard" size={22} className="opacity-50" />
                    <p>Sin fichas clinicas</p>
                </div>
            ) : (
                <div className="patient-record-list">
                    {records.map((record) => (
                        <article
                            key={record.id}
                            className="patient-record-item"
                            style={{ borderLeftColor: RECORD_TYPE_COLORS[record.type] }}
                        >
                            <div className="patient-record-item__head">
                                <div>
                                    <span style={{ color: RECORD_TYPE_COLORS[record.type] }}>
                                        {RECORD_TYPE_LABELS[record.type]}
                                    </span>
                                    <small>
                                        {new Date(record.created_at).toLocaleDateString('es-ES', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </small>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="patient-record-delete"
                                    onClick={() => onDeleteRecord(record.id)}
                                    title="Eliminar ficha"
                                >
                                    <Icon name="trash" size={14} />
                                </Button>
                            </div>

                            <div className="patient-record-item__author">
                                Por: <strong>{record.professional?.profile?.full_name || 'Profesional'}</strong>
                            </div>

                            <div className="patient-record-item__content">
                                {Object.entries(record.content as Record<string, unknown>).map(([key, value]) => {
                                    if (typeof value !== 'string' || value.trim() === '') return null;

                                    return (
                                        <div key={key}>
                                            <span>{key}</span>
                                            <p>{value}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <Card className="sticky top-6 patient-detail-card">
            <CardHeader className="patient-detail-card__head">
                <CardTitle className="text-xl">
                    {patient.first_name} {patient.last_name}
                </CardTitle>

                <div className="patient-detail-card__head-actions">
                    <Button variant="ghost" size="sm" onClick={onEdit} title="Editar paciente" className="patient-detail-card__icon-btn">
                        <Icon name="edit" size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose} className="patient-detail-card__icon-btn">
                        <Icon name="close" size={18} />
                    </Button>
                </div>
            </CardHeader>

            <div className="patient-detail-tabs">
                {([
                    { key: 'datos', label: 'Datos', icon: 'user' },
                    { key: 'citas', label: `Citas (${appointments.length})`, icon: 'calendar' },
                    { key: 'clinico', label: `Fichas (${records.length})`, icon: 'clipboard' },
                ] as const).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`patient-detail-tab ${activeTab === tab.key ? 'is-active' : ''}`}
                    >
                        <Icon name={tab.icon} size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <CardContent className="p-4 max-h-[640px] overflow-y-auto">
                {activeTab === 'datos' && renderDatos()}
                {activeTab === 'citas' && renderCitas()}
                {activeTab === 'clinico' && renderClinico()}
            </CardContent>
        </Card>
    );
}
