'use client';

import React, { useState } from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import ConfirmModal from '@/components/ConfirmModal';
import { getAvatarColor, getInitials } from '@/lib/utils';
import type { Appointment } from '@/lib/types';
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from '@/lib/types';
import { getReceiptDownloadUrl, usePayments } from '@/hooks/usePayments';
import { PaymentModal } from '@/app/(admin)/facturacion/components/PaymentModal';

interface AppointmentDetailPanelProps {
    appointment: Appointment | null;
    onClose: () => void;
    onUpdateStatus: (id: string, status: string) => Promise<void>;
    onInitiateCancel: (apt: Appointment) => void;
    onInitiateReschedule?: (apt: Appointment) => void;
    onInitiateDelete?: (apt: Appointment) => void;
    variant?: 'inline' | 'overlay';
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const STATUS_BADGE_VARIANT: Record<Appointment['status'], BadgeVariant> = {
    pending: 'warning',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'danger',
};

export function AppointmentDetailPanel({
    appointment,
    onClose,
    onUpdateStatus,
    onInitiateCancel,
    onInitiateReschedule,
    onInitiateDelete,
    variant = 'overlay',
}: AppointmentDetailPanelProps) {
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const { data: paymentsForAppt = [] } = usePayments(
        appointment ? { appointment_id: appointment.id } : {}
    );

    if (!appointment) return null;

    const existingPayment = paymentsForAppt[0] ?? null;
    const isCancelled = appointment.status === 'cancelled';
    const canRegisterPayment = !isCancelled && !existingPayment;

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const isActionable = appointment.status !== 'cancelled' && appointment.status !== 'completed';

    const panelClassName =
        variant === 'inline'
            ? 'zc-detail-panel zc-detail-panel--inline animate-in slide-in-from-right duration-300'
            : 'zc-detail-panel zc-detail-panel--overlay animate-in slide-in-from-right duration-300';

    return (
        <>
        <aside className={panelClassName}>
            <div className="zc-detail-panel__head">
                <h3>Detalle de cita</h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="zc-detail-panel__close"
                    aria-label="Cerrar detalle"
                >
                    <Icon name="close" size={18} />
                </button>
            </div>

            <div className="zc-detail-panel__body">
                <div className="zc-detail-patient">
                    <div
                        className="zc-detail-patient__avatar"
                        style={{ background: getAvatarColor(appointment.patient_name || 'P') }}
                    >
                        {getInitials(appointment.patient_name || 'P')}
                    </div>

                    <div className="zc-detail-patient__info">
                        <strong>{appointment.patient_name || 'Paciente'}</strong>
                        {appointment.patient_phone && (
                            <span>
                                <Icon name="phone" size={12} />
                                {appointment.patient_phone}
                            </span>
                        )}
                        {appointment.patient_email && (
                            <span>
                                <Icon name="mail" size={12} />
                                {appointment.patient_email}
                            </span>
                        )}
                    </div>
                </div>

                <div className="zc-detail-list">
                    <div className="zc-detail-row">
                        <span>Servicio</span>
                        <strong>{appointment.service?.name || 'Cita general'}</strong>
                    </div>

                    <div className="zc-detail-row">
                        <span>Fecha</span>
                        <strong>
                            {new Date(appointment.start_time).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                            })}
                        </strong>
                    </div>

                    <div className="zc-detail-row">
                        <span>Horario</span>
                        <strong>
                            {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                        </strong>
                    </div>

                    <div className="zc-detail-row">
                        <span>Profesional</span>
                        <strong>{appointment.professional?.profile?.full_name || 'Sin asignar'}</strong>
                    </div>

                    <div className="zc-detail-row">
                        <span>Estado</span>
                        <Badge variant={STATUS_BADGE_VARIANT[appointment.status]}>
                            {STATUS_LABELS[appointment.status]}
                        </Badge>
                    </div>

                    <div className="zc-detail-row">
                        <span>Cobro</span>
                        {existingPayment ? (
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="success">
                                    Pagado · {new Intl.NumberFormat('es-ES', {
                                        style: 'currency',
                                        currency: 'EUR',
                                    }).format(Number(existingPayment.amount))}
                                </Badge>
                                <span className="text-xs text-[var(--text-muted)]">
                                    {PAYMENT_METHOD_LABELS[existingPayment.method]} ·{' '}
                                    <span className="font-mono">{existingPayment.receipt_number}</span>
                                </span>
                            </div>
                        ) : (
                            <Badge variant={isCancelled ? 'default' : 'warning'}>
                                {isCancelled ? 'No aplica' : 'Pendiente'}
                            </Badge>
                        )}
                    </div>

                    {appointment.notes && (
                        <div className="zc-detail-row zc-detail-row--notes">
                            <span>Notas</span>
                            <p>{appointment.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {(isActionable || canRegisterPayment || existingPayment || (isCancelled && onInitiateDelete)) && (
                <div className="zc-detail-panel__actions">
                    {canRegisterPayment && (
                        <Button
                            variant="primary"
                            className="w-full justify-center"
                            onClick={() => setPaymentModalOpen(true)}
                            leftIcon={<Icon name="wallet" size={14} />}
                        >
                            Registrar cobro
                        </Button>
                    )}

                    {existingPayment && (
                        <a
                            href={getReceiptDownloadUrl(existingPayment.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--secondary w-full justify-center"
                        >
                            <Icon name="download" size={14} />
                            Descargar recibo
                        </a>
                    )}

                    {isActionable && onInitiateReschedule && (
                        <Button
                            variant="secondary"
                            className="w-full justify-center"
                            onClick={() => onInitiateReschedule(appointment)}
                            leftIcon={<Icon name="calendar" size={14} />}
                        >
                            Reprogramar
                        </Button>
                    )}

                    {isActionable && (
                        <Button
                            variant="secondary"
                            className="w-full justify-center"
                            onClick={() => setShowCompleteConfirm(true)}
                            leftIcon={<Icon name="check" size={14} />}
                        >
                            Marcar completada
                        </Button>
                    )}

                    {isActionable && (
                        <Button
                            variant="secondary"
                            className="w-full justify-center text-red-600 bg-red-50 hover:bg-red-100 border-red-200"
                            onClick={() => onInitiateCancel(appointment)}
                            leftIcon={<Icon name="close" size={14} />}
                        >
                            Cancelar cita
                        </Button>
                    )}

                    {isCancelled && onInitiateDelete && (
                        <Button
                            variant="danger"
                            className="w-full justify-center"
                            onClick={() => onInitiateDelete(appointment)}
                            leftIcon={<Icon name="trash" size={14} />}
                        >
                            Eliminar cita
                        </Button>
                    )}
                </div>
            )}
        </aside>

        {showCompleteConfirm && (
            <ConfirmModal
                title="Marcar como completada"
                message="¿Confirmas que esta cita ha finalizado? Al confirmar te abrirá el cobro automáticamente."
                confirmLabel="Marcar completada"
                cancelLabel="Cancelar"
                variant="info"
                onConfirm={async () => {
                    setShowCompleteConfirm(false);
                    await onUpdateStatus(appointment.id, 'completed');
                    if (!existingPayment) {
                        setPaymentModalOpen(true);
                    }
                }}
                onCancel={() => setShowCompleteConfirm(false)}
            />
        )}

        <PaymentModal
            isOpen={paymentModalOpen}
            onClose={() => setPaymentModalOpen(false)}
            appointmentId={appointment.id}
            defaultAmount={appointment.service?.price}
        />
        </>
    );
}
