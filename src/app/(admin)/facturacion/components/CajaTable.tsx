'use client';

import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { PAYMENT_METHOD_LABELS } from '@/lib/types';
import type { PaymentWithRelations } from '@/hooks/usePayments';
import { getReceiptDownloadUrl } from '@/hooks/usePayments';

interface CajaTableProps {
    payments: PaymentWithRelations[];
    isLoading: boolean;
    onDelete: (paymentId: string) => void;
}

function formatDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function formatEuro(value: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(value);
}

export function CajaTable({ payments, isLoading, onDelete }: CajaTableProps) {
    if (isLoading) {
        return <p className="text-sm text-gray-500 py-8 text-center">Cargando cobros…</p>;
    }

    if (payments.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <p className="text-sm text-gray-500">
                    No hay cobros registrados en este periodo.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    <tr>
                        <th className="px-3 py-2">Recibo</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Paciente</th>
                        <th className="px-3 py-2">Servicio</th>
                        <th className="px-3 py-2">Método</th>
                        <th className="px-3 py-2 text-right">Importe</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {payments.map((p) => {
                        const patientName = p.patient
                            ? `${p.patient.first_name} ${p.patient.last_name}`
                            : '—';
                        const serviceName = p.appointment?.service?.name ?? '—';
                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-xs text-gray-700">
                                    {p.receipt_number}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                    {formatDateTime(p.paid_at)}
                                </td>
                                <td className="px-3 py-2 text-gray-800">{patientName}</td>
                                <td className="px-3 py-2 text-gray-600">{serviceName}</td>
                                <td className="px-3 py-2 text-gray-600">
                                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                    {formatEuro(Number(p.amount))}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <div className="inline-flex gap-1">
                                        <a
                                            href={getReceiptDownloadUrl(p.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                            aria-label={`Descargar recibo ${p.receipt_number}`}
                                        >
                                            <Icon name="download" size={13} />
                                            Recibo
                                        </a>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(p.id)}
                                            aria-label={`Anular cobro ${p.receipt_number}`}
                                        >
                                            <Icon name="trash" size={13} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
