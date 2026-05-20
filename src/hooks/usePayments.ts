import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Appointment, Patient, Payment, Service } from '@/lib/types';
import { PaymentSchema } from '@/lib/schemas';
import { readApiError } from '@/lib/api-helpers';

export const PAYMENTS_QUERY_KEY = ['payments'];

export interface PaymentWithRelations extends Omit<Payment, 'appointment' | 'patient'> {
    appointment: (Appointment & { service?: Service | null }) | null;
    patient: Patient | null;
}

export interface PaymentFilters {
    from?: string;
    to?: string;
    method?: Payment['method'];
    appointment_id?: string;
    patient_id?: string;
}

function buildQueryString(filters: PaymentFilters): string {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.method) params.set('method', filters.method);
    if (filters.appointment_id) params.set('appointment_id', filters.appointment_id);
    if (filters.patient_id) params.set('patient_id', filters.patient_id);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export function usePayments(filters: PaymentFilters = {}) {
    return useQuery({
        queryKey: [...PAYMENTS_QUERY_KEY, filters],
        queryFn: async () => {
            const response = await fetch(`/api/admin/payments${buildQueryString(filters)}`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
            return (await response.json()) as PaymentWithRelations[];
        },
    });
}

export interface CreatePaymentInput {
    appointment_id: string;
    amount: number;
    method: Payment['method'];
    paid_at?: string;
    notes?: string | null;
}

export function useCreatePayment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreatePaymentInput) => {
            PaymentSchema.parse(input);
            const response = await fetch('/api/admin/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(input),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
            return (await response.json()) as PaymentWithRelations;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['citas'] });
        },
    });
}

export function useDeletePayment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`/api/admin/payments/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['citas'] });
        },
    });
}

export function getReceiptDownloadUrl(paymentId: string): string {
    return `/api/admin/payments/receipt/${paymentId}`;
}

export function getPaymentsExportUrl(filters: PaymentFilters = {}): string {
    return `/api/admin/payments/export${buildQueryString(filters)}`;
}
