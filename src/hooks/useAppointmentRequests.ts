import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readApiError } from '@/lib/api-helpers';

export interface AppointmentRequest {
    id: string;
    patient_id: string;
    patient_name: string | null;
    patient_phone: string | null;
    professional_id: string;
    professional_name: string | null;
    service_id: string;
    service_name: string | null;
    service_duration_minutes: number | null;
    preferred_date: string;
    notes: string | null;
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
    created_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
}

export const APPOINTMENT_REQUESTS_QUERY_KEY = ['appointment-requests'] as const;
export const APPOINTMENT_REQUESTS_COUNT_KEY = ['appointment-requests', 'pending-count'] as const;

type StatusFilter = 'pending' | 'all';

export function useAppointmentRequests(status: StatusFilter = 'pending') {
    return useQuery({
        queryKey: [...APPOINTMENT_REQUESTS_QUERY_KEY, status],
        queryFn: async () => {
            const response = await fetch(`/api/admin/appointment-requests?status=${status}`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error(await readApiError(response));
            const json = (await response.json()) as { requests: AppointmentRequest[] };
            return json.requests;
        },
        refetchInterval: 60000,
    });
}

export function useAppointmentRequestsPendingCount() {
    return useQuery({
        queryKey: APPOINTMENT_REQUESTS_COUNT_KEY,
        queryFn: async () => {
            const response = await fetch('/api/admin/appointment-requests/pending-count', {
                method: 'GET',
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error(await readApiError(response));
            const json = (await response.json()) as { count: number };
            return json.count;
        },
        refetchInterval: 60000,
    });
}

interface ResolvePayload {
    id: string;
    status: 'accepted' | 'declined';
    resolution_note?: string;
}

export function useResolveAppointmentRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: ResolvePayload) => {
            const response = await fetch(`/api/admin/appointment-requests/${payload.id}`, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: payload.status,
                    resolution_note: payload.resolution_note,
                }),
            });
            if (!response.ok) throw new Error(await readApiError(response));
            return (await response.json()) as { ok: true; id: string; status: string };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENT_REQUESTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: APPOINTMENT_REQUESTS_COUNT_KEY });
        },
    });
}
