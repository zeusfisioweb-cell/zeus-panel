import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

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
            const json = await apiFetch<{ requests: AppointmentRequest[] }>(
                `/api/admin/appointment-requests?status=${status}`,
            );
            return json.requests;
        },
        refetchInterval: 60000,
    });
}

export function useAppointmentRequestsPendingCount() {
    return useQuery({
        queryKey: APPOINTMENT_REQUESTS_COUNT_KEY,
        queryFn: async () => {
            const json = await apiFetch<{ count: number }>('/api/admin/appointment-requests/pending-count');
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
        mutationFn: (payload: ResolvePayload) =>
            apiFetch<{ ok: true; id: string; status: string }>(
                `/api/admin/appointment-requests/${payload.id}`,
                {
                    method: 'PATCH',
                    body: { status: payload.status, resolution_note: payload.resolution_note },
                },
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENT_REQUESTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: APPOINTMENT_REQUESTS_COUNT_KEY });
        },
    });
}
