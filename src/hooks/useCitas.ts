import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Appointment, AppointmentStatus, ScheduleException } from '@/lib/types';
import { AppointmentInsertSchema, AppointmentUpdateSchema, ScheduleExceptionSchema } from '@/lib/schemas';
import { readApiError } from '@/lib/api-helpers';

export const APPOINTMENTS_QUERY_KEY = ['citas'];


export function useCitas(start_date?: string, end_date?: string) {
    const supabase = useMemo(() => createClient(), []);
    const queryClient = useQueryClient();

    useEffect(() => {
        // Generate name inside effect — StrictMode preserves refs across mount cycles,
        // so useRef would reuse the same channel name and re-add `.on()` to the
        // already-subscribed channel before async `removeChannel` resolved.
        const channelName = `appointments_changes_${crypto.randomUUID()}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    // queryClient is stable from React Query; supabase is stable from useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return useQuery({
        queryKey: [...APPOINTMENTS_QUERY_KEY, start_date, end_date],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (start_date) params.set('start_date', start_date);
            if (end_date) params.set('end_date', end_date);
            const queryString = params.toString();

            const response = await fetch(`/api/admin/appointments${queryString ? `?${queryString}` : ''}`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Appointment[];
        },
    });
}

export function useCreateCita() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newAppointment: Partial<Appointment>) => {
            const parsed = AppointmentInsertSchema.parse(newAppointment);

            const response = await fetch('/api/admin/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(parsed),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Appointment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
        },
    });
}

export function useUpdateCita() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: Partial<Appointment> & { id: string }) => {
            const parsedUpdateData = AppointmentUpdateSchema.parse(updateData);

            const response = await fetch('/api/admin/appointments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id, ...parsedUpdateData }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Appointment;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            const previousAppointments = queryClient.getQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY });

            queryClient.setQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY }, (oldData: Appointment[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map((apt) => (apt.id === variables.id ? { ...apt, ...variables } : apt));
            });

            return { previousAppointments };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousAppointments) {
                context.previousAppointments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
        },
    });
}

export function useUpdateCitaStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
            const response = await fetch('/api/admin/appointments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id, status }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Appointment;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            const previousAppointments = queryClient.getQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY });

            queryClient.setQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY }, (oldData: Appointment[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map((apt) => (apt.id === variables.id ? { ...apt, status: variables.status } : apt));
            });

            return { previousAppointments };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousAppointments) {
                context.previousAppointments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export function useCancelCita() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) => {
            const payload: { id: string; status: AppointmentStatus; cancellation_reason?: string } = {
                id,
                status: 'cancelled',
            };

            if (reason) {
                payload.cancellation_reason = reason;
            }

            const response = await fetch('/api/admin/appointments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Appointment;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            const previousAppointments = queryClient.getQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY });

            queryClient.setQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY }, (oldData: Appointment[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map((apt) => (apt.id === variables.id
                    ? {
                        ...apt,
                        status: 'cancelled',
                        ...(variables.reason ? { cancellation_reason: variables.reason } : {}),
                    }
                    : apt));
            });

            return { previousAppointments };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousAppointments) {
                context.previousAppointments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export function useDeleteCita() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`/api/admin/appointments/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export const SCHEDULE_EXCEPTIONS_QUERY_KEY = ['schedule_exceptions'];

export function useScheduleExceptions({
    startDate,
    endDate,
    professionalId,
}: {
    startDate?: string;
    endDate?: string;
    professionalId?: string;
}) {
    return useQuery({
        queryKey: [...SCHEDULE_EXCEPTIONS_QUERY_KEY, startDate, endDate, professionalId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.set('start_date', startDate);
            if (endDate) params.set('end_date', endDate);
            if (professionalId) params.set('professional_id', professionalId);

            const response = await fetch(`/api/admin/schedule-exceptions?${params.toString()}`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as ScheduleException[];
        },
    });
}

export function useCreateException() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newException: Record<string, unknown>) => {
            const parsed = ScheduleExceptionSchema.parse(newException);

            const response = await fetch('/api/admin/schedule-exceptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(parsed),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as ScheduleException;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULE_EXCEPTIONS_QUERY_KEY });
        },
    });
}
