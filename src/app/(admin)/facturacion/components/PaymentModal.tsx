'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useCitas } from '@/hooks/useCitas';
import { useCreatePayment } from '@/hooks/usePayments';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/types';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointmentId?: string;
    defaultAmount?: number;
}

const METHODS: PaymentMethod[] = ['cash', 'card', 'bizum', 'transfer', 'other'];

function isoDate(daysOffset = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().slice(0, 10);
}

export function PaymentModal({
    isOpen,
    onClose,
    appointmentId: initialAppointmentId,
    defaultAmount,
}: PaymentModalProps) {
    const [appointmentId, setAppointmentId] = useState(initialAppointmentId ?? '');
    const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
    const [method, setMethod] = useState<PaymentMethod>('cash');
    const [notes, setNotes] = useState('');

    const { data: citas, isLoading: loadingCitas } = useCitas(isoDate(-30), isoDate(7));
    const createPayment = useCreatePayment();

    const eligibleCitas = useMemo(
        () =>
            (citas ?? [])
                .filter((c) => c.patient_id && c.status !== 'cancelled')
                .sort(
                    (a, b) =>
                        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                ),
        [citas]
    );

    useEffect(() => {
        if (!isOpen) return;
        setAppointmentId(initialAppointmentId ?? '');
        setAmount(defaultAmount ? String(defaultAmount) : '');
        setMethod('cash');
        setNotes('');
    }, [isOpen, initialAppointmentId, defaultAmount]);

    function handleAppointmentChange(id: string) {
        setAppointmentId(id);
        const cita = eligibleCitas.find((c) => c.id === id);
        if (cita?.service?.price && !defaultAmount) {
            setAmount(String(cita.service.price));
        }
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!appointmentId) {
            toast.error('Selecciona una cita');
            return;
        }
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error('Importe inválido');
            return;
        }

        try {
            await createPayment.mutateAsync({
                appointment_id: appointmentId,
                amount: parsedAmount,
                method,
                notes: notes.trim() || null,
            });
            toast.success('Cobro registrado');
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al registrar cobro';
            toast.error(message);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar cobro" maxWidth="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                        Cita
                    </label>
                    <select
                        value={appointmentId}
                        onChange={(e) => handleAppointmentChange(e.target.value)}
                        disabled={loadingCitas || Boolean(initialAppointmentId)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        required
                    >
                        <option value="">Selecciona una cita…</option>
                        {eligibleCitas.map((c) => {
                            const date = new Date(c.start_time).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                            });
                            const patient = c.patient
                                ? `${c.patient.first_name} ${c.patient.last_name}`
                                : c.patient_name ?? 'Paciente';
                            const service = c.service?.name ?? 'Servicio';
                            return (
                                <option key={c.id} value={c.id}>
                                    {date} · {patient} · {service}
                                </option>
                            );
                        })}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                            Importe (€)
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                            Método
                        </label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            required
                        >
                            {METHODS.map((m) => (
                                <option key={m} value={m}>
                                    {PAYMENT_METHOD_LABELS[m]}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                        Notas (opcional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        maxLength={500}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Ej: cobro parcial, propina, etc."
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" isLoading={createPayment.isPending}>
                        Registrar
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
