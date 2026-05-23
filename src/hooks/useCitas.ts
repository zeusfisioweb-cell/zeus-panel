import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Appointment, AppointmentStatus, ScheduleException } from '@/lib/types';
import { AppointmentInsertSchema, AppointmentUpdateSchema, ScheduleExceptionSchema } from '@/lib/schemas';
import { apiFetch, buildSearchParams } from '@/lib/api-client';

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
        queryFn: () => {
            const qs = buildSearchParams({ start_date, end_date });
            return apiFetch<Appointment[]>(`/api/admin/appointments${qs}`);
        },
    });
}

export function useCreateCita() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (newAppointment: Partial<Appointment>) => {
            const parsed = AppointmentInsertSchema.parse(newAppointment);
            return apiFetch<Appointment>('/api/admin/appointments', { method: 'POST', body: parsed });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
        },
    });
}

export function useUpdateCita() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, ...updateData }: Partial<Appointment> & { id: string }) => {
            const parsed = AppointmentUpdateSchema.parse(updateData);
            return apiFetch<Appointment>('/api/admin/appointments', {
                method: 'PATCH',
                body: { id, ...parsed },
            });
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
        mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
            apiFetch<Appointment>('/api/admin/appointments', {
                method: 'PATCH',
                body: { id, status },
            }),
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
        mutationFn: ({ id, reason }: { id: string; reason?: string | null }) => {
            const payload: { id: string; status: AppointmentStatus; cancellation_reason?: string } = {
                id,
                status: 'cancelled',
            };
            if (reason) payload.cancellation_reason = reason;
            return apiFetch<Appointment>('/api/admin/appointments', { method: 'PATCH', body: payload });
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
        mutationFn: (id: string) =>
            apiFetch<void>(`/api/admin/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
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
        queryFn: () => {
            const qs = buildSearchParams({
                start_date: startDate,
                end_date: endDate,
                professional_id: professionalId,
            });
            return apiFetch<ScheduleException[]>(`/api/admin/schedule-exceptions${qs}`);
        },
    });
}

export function useCreateException() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (newException: Record<string, unknown>) => {
            const parsed = ScheduleExceptionSchema.parse(newException);
            return apiFetch<ScheduleException>('/api/admin/schedule-exceptions', {
                method: 'POST',
                body: parsed,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULE_EXCEPTIONS_QUERY_KEY });
        },
    });
}
