import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Appointment, Patient, Payment, Service } from '@/lib/types';
import { PaymentSchema } from '@/lib/schemas';
import { apiFetch, buildSearchParams } from '@/lib/api-client';

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

function paymentsQuery(filters: PaymentFilters): string {
    return buildSearchParams({
        from: filters.from,
        to: filters.to,
        method: filters.method,
        appointment_id: filters.appointment_id,
        patient_id: filters.patient_id,
    });
}

export function usePayments(filters: PaymentFilters = {}) {
    return useQuery({
        queryKey: [...PAYMENTS_QUERY_KEY, filters],
        queryFn: () => apiFetch<PaymentWithRelations[]>(`/api/admin/payments${paymentsQuery(filters)}`),
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
        mutationFn: (input: CreatePaymentInput) => {
            PaymentSchema.parse(input);
            return apiFetch<PaymentWithRelations>('/api/admin/payments', {
                method: 'POST',
                body: input,
            });
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
        mutationFn: (id: string) =>
            apiFetch<void>(`/api/admin/payments/${id}`, { method: 'DELETE' }),
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
    return `/api/admin/payments/export${paymentsQuery(filters)}`;
}
