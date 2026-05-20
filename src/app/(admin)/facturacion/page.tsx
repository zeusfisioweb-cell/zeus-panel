'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmModal from '@/components/ConfirmModal';
import {
    getPaymentsExportUrl,
    useDeletePayment,
    usePayments,
} from '@/hooks/usePayments';
import type { Payment } from '@/lib/types';
import { PAYMENT_METHOD_LABELS } from '@/lib/types';
import { FacturacionHeader } from './components/FacturacionHeader';
import { CajaTable } from './components/CajaTable';
import { PaymentModal } from './components/PaymentModal';

const METHOD_OPTIONS: Array<{ value: Payment['method'] | ''; label: string }> = [
    { value: '', label: 'Todos los métodos' },
    ...(Object.keys(PAYMENT_METHOD_LABELS) as Payment['method'][]).map((m) => ({
        value: m,
        label: PAYMENT_METHOD_LABELS[m],
    })),
];

function startOfDayIso(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function endOfDayIso(date: Date): string {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
}

function isoDate(daysOffset = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().slice(0, 10);
}

export default function FacturacionPage() {
    const [from, setFrom] = useState(() => isoDate(-30));
    const [to, setTo] = useState(() => isoDate(0));
    const [method, setMethod] = useState<Payment['method'] | ''>('');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const filters = useMemo(
        () => ({
            from: from ? startOfDayIso(new Date(from)) : undefined,
            to: to ? endOfDayIso(new Date(to)) : undefined,
            method: method || undefined,
        }),
        [from, to, method]
    );

    const { data: payments = [], isLoading } = usePayments(filters);
    const deletePayment = useDeletePayment();

    const totals = useMemo(() => {
        const now = new Date();
        const startToday = startOfDayIso(now);
        const startWeek = new Date(now);
        startWeek.setDate(startWeek.getDate() - 6);
        const startWeekIso = startOfDayIso(startWeek);
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        let today = 0;
        let week = 0;
        let month = 0;

        for (const p of payments) {
            const paid = p.paid_at;
            const amount = Number(p.amount);
            if (paid >= startToday) today += amount;
            if (paid >= startWeekIso) week += amount;
            if (paid >= startMonth) month += amount;
        }

        return { today, week, month };
    }, [payments]);

    function handleExportCsv() {
        const url = getPaymentsExportUrl(filters);
        window.open(url, '_blank');
    }

    async function handleConfirmDelete() {
        if (!pendingDeleteId) return;
        try {
            await deletePayment.mutateAsync(pendingDeleteId);
            toast.success('Cobro anulado');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al anular cobro';
            toast.error(message);
        } finally {
            setPendingDeleteId(null);
        }
    }

    return (
        <div className="space-y-4">
            <FacturacionHeader
                todayTotal={totals.today}
                weekTotal={totals.week}
                monthTotal={totals.month}
                paymentsCount={payments.length}
                onNewPayment={() => setPaymentModalOpen(true)}
                onExportCsv={handleExportCsv}
            />

            <div className="rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap gap-3 items-end">
                <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Desde
                    </label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Hasta
                    </label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Método
                    </label>
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value as Payment['method'] | '')}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                        {METHOD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <CajaTable
                payments={payments}
                isLoading={isLoading}
                onDelete={setPendingDeleteId}
            />

            <PaymentModal
                isOpen={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
            />

            {pendingDeleteId && (
                <ConfirmModal
                    title="Anular cobro"
                    message="Esta acción borra el cobro y queda registrada en auditoría. ¿Continuar?"
                    confirmLabel="Anular"
                    cancelLabel="Cancelar"
                    variant="danger"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDeleteId(null)}
                />
            )}
        </div>
    );
}
