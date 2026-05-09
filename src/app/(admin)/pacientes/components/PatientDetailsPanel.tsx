'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Patient, Appointment, PatientDocument, UserRole } from '@/lib/types';
import { PATIENT_DOCUMENT_STATUS_LABELS, PATIENT_DOCUMENT_TYPE_LABELS, STATUS_LABELS } from '@/lib/types';
import { getDocumentFields } from '@/lib/patient-document-definitions';
import { sanitizeDocumentFormData } from '@/lib/patient-document-definitions';

type DetailTab = 'datos' | 'citas' | 'clinico';

interface PatientDetailsPanelProps {
    patient: Patient;
    appointments: Appointment[];
    documents: PatientDocument[];
    onClose: () => void;
    onEdit: () => void;
    onDelete: (id: string) => void;
    onEditDocument: (document: PatientDocument) => void;
    onDeleteDocument: (id: string) => void;
    onNewDocument: () => void;
    onUnlinkPortal?: (id: string) => void;
    userRole?: UserRole;
}

function getAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
}

export function PatientDetailsPanel({
    patient,
    appointments,
    documents,
    onClose,
    onEdit,
    onDelete,
    onEditDocument,
    onDeleteDocument,
    onNewDocument,
    onUnlinkPortal,
    userRole,
}: PatientDetailsPanelProps) {
    const documentFieldLabels = new Map(
        (['clinical_history', 'intervention_consent', 'data_consent'] as const).flatMap((type) =>
            getDocumentFields(type).map((field) => [field.key, field.label] as const)
        )
    );

    const isOwner = userRole === 'owner';
    const [activeTab, setActiveTab] = useState<DetailTab>('datos');
    const [exporting, setExporting] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteSent, setInviteSent] = useState(false);

    useEffect(() => { setInviteSent(false); }, [patient.id]);

    const age = patient.birth_date ? getAge(patient.birth_date) : null;
    const isMinorApproachingAutonomy = age !== null && age >= 15 && age < 16;
    const hasPortalAccount = Boolean(patient.auth_user_id);
    const isManagedByGuardian = Boolean(patient.guardian_auth_user_id);

    async function handleUnlinkPortal() {
        if (!confirm('¿Desvincular la cuenta del portal? El paciente deberá completar el perfil de nuevo para volver a acceder.')) return;
        setUnlinking(true);
        const res = await fetch(`/api/admin/patients/${patient.id}/unlink-portal`, { method: 'POST' });
        setUnlinking(false);
        if (res.ok) {
            toast.success('Cuenta del portal desvinculada');
            onUnlinkPortal?.(patient.id);
        } else {
            toast.error('Error al desvincular la cuenta');
        }
    }

    async function handleInvitePortal() {
        setInviting(true);
        const res = await fetch('/api/admin/portal/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ patient_id: patient.id }),
        });
        setInviting(false);
        if (res.ok) {
            setInviteSent(true);
            toast.success(`Invitación enviada a ${patient.email}`);
        } else {
            const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
            toast.error((body as { error?: string }).error ?? 'Error al enviar la invitación');
        }
    }

    const handleExportGdpr = async () => {
        setExporting(true);
        try {
            const res = await fetch(`/api/admin/patients/${encodeURIComponent(patient.id)}/export`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
                throw new Error((body as { error?: string }).error || 'Error de servidor');
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `paciente_${patient.first_name}_${patient.last_name}_rgpd.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Datos exportados correctamente');
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Error al exportar datos');
        } finally {
            setExporting(false);
        }
    };

    const handleExportCsv = async () => {
        setExportingCsv(true);
        try {
            const res = await fetch(`/api/admin/patients/${encodeURIComponent(patient.id)}/export?format=csv`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
                throw new Error((body as { error?: string }).error || 'Error de servidor');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `paciente_${patient.first_name}_${patient.last_name}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('CSV exportado correctamente');
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Error al exportar CSV');
        } finally {
            setExportingCsv(false);
        }
    };

    const renderDatos = () => (
        <div className="patient-detail-grid">
            {isMinorApproachingAutonomy && !patient.document_id && (
                <div className="patient-detail-item patient-detail-item--full" style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem 1rem', color: '#92400e' }}>
                    <strong>⚠ Acción requerida:</strong> Este paciente tiene {age} años y alcanzará autonomía sanitaria (16 años) próximamente. Sin DNI registrado no podrá acceder al portal de forma independiente. Añade su DNI en edición.
                </div>
            )}
            {isManagedByGuardian && (
                <div className="patient-detail-item patient-detail-item--full" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.5rem 1rem', color: '#0369a1', fontSize: '0.85rem' }}>
                    Gestionado por tutor legal (Ley 41/2002)
                </div>
            )}
            <div className="patient-detail-item">
                <span>Teléfono</span>
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
                <span>Fecha de nacimiento</span>
                <strong>{patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('es-ES') : '—'}</strong>
            </div>
            <div className="patient-detail-item patient-detail-item--full">
                <span>Dirección</span>
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
                    {patient.marketing_consent ? 'Sí' : 'No'}
                </Badge>
            </div>

            {/* Portal access status */}
            <div className="patient-detail-item patient-detail-item--full">
                <span>Acceso al portal</span>
                {hasPortalAccount ? (
                    <Badge variant="success">Cuenta activa</Badge>
                ) : patient.email && !isManagedByGuardian ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Badge variant="default">Sin cuenta</Badge>
                        {inviteSent ? (
                            <Badge variant="success">Invitación enviada</Badge>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleInvitePortal}
                                disabled={inviting}
                                isLoading={inviting}
                                leftIcon={<Icon name="mail" size={13} />}
                            >
                                Invitar al portal
                            </Button>
                        )}
                    </div>
                ) : (
                    <Badge variant="default">{isManagedByGuardian ? 'Gestionado por tutor' : 'Sin email'}</Badge>
                )}
            </div>

            <div className="patient-detail-danger">
                {isOwner && (
                    <>
                        {hasPortalAccount && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleUnlinkPortal}
                                disabled={unlinking}
                                isLoading={unlinking}
                                leftIcon={<Icon name="close" size={14} />}
                            >
                                Desvincular cuenta portal
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportGdpr}
                            disabled={exporting}
                            leftIcon={<Icon name="download" size={14} />}
                            isLoading={exporting}
                        >
                            Exportar datos (RGPD)
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportCsv}
                            disabled={exportingCsv}
                            leftIcon={<Icon name="download" size={14} />}
                            isLoading={exportingCsv}
                        >
                            Exportar CSV
                        </Button>
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
                            Cumplimiento RGPD: exporta o elimina los datos identificables del paciente.
                        </p>
                    </>
                )}
            </div>
        </div>
    );

    const renderCitas = () => {
        if (appointments.length === 0) {
            return (
                <div className="zs-drawer__empty">
                    <Icon name="calendar" size={22} className="opacity-50" />
                    <p>Sin citas registradas</p>
                </div>
            );
        }

        const STATUS_DOT: Record<string, string> = {
            completed: '#22c55e',
            confirmed: '#3b82f6',
            pending: '#f59e0b',
            cancelled: '#ef4444',
        };

        return (
            <div className="zs-citas-timeline">
                {appointments.map((appt) => (
                    <div key={appt.id} className="zs-citas-tl-item">
                        <div className="zs-citas-tl-item__dot" style={{ background: STATUS_DOT[appt.status] ?? 'var(--brand-canela)' }} />
                        <div className="zs-citas-tl-item__body">
                            <div className="zs-citas-tl-item__service">{appt.service?.name || 'Servicio general'}</div>
                            <div className="zs-citas-tl-item__meta">
                                {new Date(appt.start_time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {' · '}
                                {new Date(appt.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <span className="zs-citas-tl-item__status" style={{ color: STATUS_DOT[appt.status] ?? 'var(--brand-canela)', background: `${STATUS_DOT[appt.status] ?? 'var(--brand-canela)'}18` }}>
                            {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    const renderClinico = () => {
        const docTypes: { type: import('@/lib/types').PatientDocumentType; label: string }[] = [
            { type: 'clinical_history', label: PATIENT_DOCUMENT_TYPE_LABELS.clinical_history },
            { type: 'intervention_consent', label: PATIENT_DOCUMENT_TYPE_LABELS.intervention_consent },
            { type: 'data_consent', label: PATIENT_DOCUMENT_TYPE_LABELS.data_consent },
        ];

        const byType = docTypes.map(({ type, label }) => ({
            type,
            label,
            docs: documents
                .filter((d) => d.document_type === type)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        }));

        return (
            <div className="patient-clinical">
                <div className="patient-clinical__toolbar">
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Icon name="plus" size={13} />}
                        onClick={onNewDocument}
                    >
                        Nuevo documento
                    </Button>
                </div>

                {documents.length === 0 && (
                    <div className="patient-empty-box">
                        <Icon name="clipboard" size={22} className="opacity-50" />
                        <p>Sin documentos clínico-legales. Crea el primero.</p>
                    </div>
                )}

                {byType.map(({ type, label, docs }) =>
                    docs.length === 0 ? null : (
                        <section key={type} className="patient-doc-group">
                            <h4 className="patient-doc-group__title">{label}</h4>
                            <div className="patient-record-list">
                                {docs.map((document) => (
                                    <article key={document.id} className="patient-record-item">
                                        <div className="patient-record-item__head">
                                            <div>
                                                <span>
                                                    {document.visit_date
                                                        ? new Date(document.visit_date).toLocaleDateString('es-ES', {
                                                              day: '2-digit',
                                                              month: 'short',
                                                              year: 'numeric',
                                                          })
                                                        : new Date(document.created_at).toLocaleDateString('es-ES', {
                                                              day: '2-digit',
                                                              month: 'short',
                                                              year: 'numeric',
                                                          })}
                                                </span>
                                                <small>
                                                    Actualizado:{' '}
                                                    {new Date(document.updated_at).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </small>
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

                                        <div className="patient-record-item__content">
                                            {Object.entries(sanitizeDocumentFormData(document.document_type, document.form_data)).length === 0 ? (
                                                <div>
                                                    <span>Campos del documento</span>
                                                    <p>Sin datos rellenados todavía.</p>
                                                </div>
                                            ) : (
                                                Object.entries(sanitizeDocumentFormData(document.document_type, document.form_data)).map(([key, value]) => (
                                                    <div key={key}>
                                                        <span>{documentFieldLabels.get(key) ?? key}</span>
                                                        <p>{typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value || '—')}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="patient-clinical__actions">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<Icon name="edit" size={14} />}
                                                onClick={() => onEditDocument(document)}
                                            >
                                                Rellenar / editar
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                leftIcon={<Icon name="trash" size={13} />}
                                                onClick={() => onDeleteDocument(document.id)}
                                            >
                                                Eliminar
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )
                )}
            </div>
        );
    };

    const initials = `${patient.first_name?.[0] ?? ''}${patient.last_name?.[0] ?? ''}`.toUpperCase();
    const headingId = useId();
    const drawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        drawerRef.current?.focus();
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose, patient.id]);

    return (
        <div
            ref={drawerRef}
            className="zs-drawer"
            role="region"
            aria-labelledby={headingId}
            tabIndex={-1}
        >
            {/* Glass header with canela gradient */}
            <div className="zs-drawer__head">
                <div className="zs-drawer__avatar" aria-hidden="true">{initials}</div>
                <div className="zs-drawer__identity">
                    <h2 id={headingId} className="zs-drawer__name">{patient.first_name} {patient.last_name}</h2>
                    <p className="zs-drawer__sub">{patient.email || patient.phone || 'Sin contacto'}</p>
                </div>
                <div className="zs-drawer__head-actions">
                    <Button variant="ghost" size="sm" onClick={onEdit} title="Editar" aria-label="Editar paciente" className="patient-detail-card__icon-btn">
                        <Icon name="edit" size={15} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" className="patient-detail-card__icon-btn">
                        <Icon name="close" size={17} />
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="zs-drawer__tabs">
                {([
                    { key: 'datos', label: 'Datos', icon: 'user' },
                    { key: 'citas', label: `Citas (${appointments.length})`, icon: 'calendar' },
                    { key: 'clinico', label: `Documentos (${documents.length})`, icon: 'clipboard' },
                ] as const).map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        aria-pressed={activeTab === tab.key}
                        className={`zs-drawer__tab ${activeTab === tab.key ? 'is-active' : ''}`}
                    >
                        <Icon name={tab.icon} size={13} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="zs-drawer__body">
                {activeTab === 'datos' && renderDatos()}
                {activeTab === 'citas' && renderCitas()}
                {activeTab === 'clinico' && renderClinico()}
            </div>
        </div>
    );
}
