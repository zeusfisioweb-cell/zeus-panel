import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Appointment, AppointmentStatus } from '@/lib/types';
import { logAuditEvent } from '@/lib/audit';
import { AppointmentInsertSchema, AppointmentUpdateSchema, ScheduleExceptionSchema } from '@/lib/schemas';

export const APPOINTMENTS_QUERY_KEY = ['citas'];

export function useCitas(start_date?: string, end_date?: string) {
    const supabase = createClient();

    return useQuery({
        queryKey: [...APPOINTMENTS_QUERY_KEY, start_date, end_date],
        queryFn: async () => {
            let query = supabase
                .from('appointments')
                .select(`
                    id,
                    patient_id,
                    professional_id,
                    service_id,
                    start_time,
                    end_time,
                    status,
                    notes,
                    patient_name,
                    patient_phone,
                    patient_email,
                    source,
                    cancellation_reason,
                    created_at,
                    updated_at,
                    patient:patients(id, first_name, last_name, phone, email),
                    professional:professionals(id, color_code, profile:profiles(full_name)),
                    service:services(id, name, duration_minutes, price, category:service_categories(color))
                `)
                .order('start_time', { ascending: true });

            if (start_date) {
                query = query.gte('start_time', start_date);
            }
            if (end_date) {
                query = query.lt('start_time', end_date);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Format the joined data to match the expected Appointment type
            return data.map((apt: unknown) => {
                const rawApt = apt as Record<string, unknown>;
                const prof = rawApt.professional as Record<string, unknown> | null;
                
                return {
                    ...rawApt,
                    professional: prof ? {
                        ...prof,
                        profile: Array.isArray(prof.profiles)
                            ? prof.profiles[0]
                            : prof.profiles
                    } : undefined
                };
            }) as Appointment[];
        },
    });
}

export function useCreateCita() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newAppointment: Partial<Appointment>) => {
            AppointmentInsertSchema.parse(newAppointment);

            const { data, error } = await supabase
                .from('appointments')
                .insert([newAppointment])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            logAuditEvent({ action: 'CREATE', table_name: 'appointments', record_id: data.id });
        },
    });
}

export function useUpdateCita() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: Partial<Appointment> & { id: string }) => {
            AppointmentUpdateSchema.parse(updateData);

            const { data, error } = await supabase
                .from('appointments')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            const previousAppointments = queryClient.getQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY });

            queryClient.setQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY }, (oldData: Appointment[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map(apt => apt.id === variables.id ? { ...apt, ...variables } : apt);
            });

            return { previousAppointments };
        },
        onError: (err, variables, context) => {
            if (context?.previousAppointments) {
                context.previousAppointments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
        },
        onSuccess: (data) => {
            logAuditEvent({ action: 'UPDATE', table_name: 'appointments', record_id: data.id });
        },
    });
}

export function useUpdateCitaStatus() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: { id: string, status: AppointmentStatus }) => {
            const { data, error } = await supabase
                .from('appointments')
                .update({ status })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            const previousAppointments = queryClient.getQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY });

            queryClient.setQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY }, (oldData: Appointment[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map(apt => apt.id === variables.id ? { ...apt, status: variables.status } : apt);
            });

            return { previousAppointments };
        },
        onError: (err, variables, context) => {
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
        onSuccess: (data) => {
            logAuditEvent({ action: 'UPDATE', table_name: 'appointments', record_id: data.id, details: { status: data.status } });
        },
    });
}

export function useCancelCita() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason?: string | null }) => {
            const updateData: { status: string; cancellation_reason?: string } = { status: 'cancelled' };
            if (reason) {
                updateData.cancellation_reason = reason;
            }

            const { data, error } = await supabase
                .from('appointments')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            const previousAppointments = queryClient.getQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY });

            queryClient.setQueriesData({ queryKey: APPOINTMENTS_QUERY_KEY }, (oldData: Appointment[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map(apt => apt.id === variables.id ? {
                    ...apt,
                    status: 'cancelled',
                    ...(variables.reason ? { cancellation_reason: variables.reason } : {})
                } : apt);
            });

            return { previousAppointments };
        },
        onError: (err, variables, context) => {
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
        onSuccess: (data) => {
            logAuditEvent({ action: 'UPDATE', table_name: 'appointments', record_id: data.id, details: { status: 'cancelled' } });
        },
    });
}

export function useDeleteCita() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            logAuditEvent({ action: 'DELETE', table_name: 'appointments', record_id: id });
        },
    });
}

// --- Schedule Exceptions ---

export const SCHEDULE_EXCEPTIONS_QUERY_KEY = ['schedule_exceptions'];

export function useScheduleExceptions({ startDate, endDate, professionalId }: { startDate?: string, endDate?: string, professionalId?: string }) {
    const supabase = createClient();

    return useQuery({
        queryKey: [...SCHEDULE_EXCEPTIONS_QUERY_KEY, startDate, endDate, professionalId],
        queryFn: async () => {
            let query = supabase.from('schedule_exceptions').select('*');

            if (startDate) {
                query = query.gte('exception_date', startDate);
            }
            if (endDate) {
                query = query.lte('exception_date', endDate);
            }
            if (professionalId) {
                query = query.eq('professional_id', professionalId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });
}

export function useCreateException() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newException: Record<string, unknown>) => {
            ScheduleExceptionSchema.parse(newException);

            const { data, error } = await supabase
                .from('schedule_exceptions')
                .insert([newException])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULE_EXCEPTIONS_QUERY_KEY });
        },
    });
}
