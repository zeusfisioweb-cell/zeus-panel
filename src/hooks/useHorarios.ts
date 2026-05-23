import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { ScheduleSlot, ScheduleException } from '@/lib/types';
import { apiFetch } from '@/lib/api-client';

export const HORARIOS_QUERY_KEY = 'horario';

// --- ZOD SCHEMAS ---
export const CreateSlotSchema = z.object({
    professional_id: z.string().uuid("ID de profesional inválido"),
    day_of_week: z.number().int().min(1).max(7),
    start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, "Hora inválida"),
    end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, "Hora inválida"),
}).refine(data => data.start_time < data.end_time, {
    message: "La hora de inicio debe ser anterior a la de fin",
    path: ["start_time"],
});

export const CreateExceptionSchema = z.object({
    professional_id: z.string().uuid("ID de profesional inválido"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    end_date: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    is_available: z.boolean(),
});

export const ApplyDefaultScheduleSchema = z.object({
    professional_id: z.string().uuid("ID de profesional inválido"),
    slots: z.array(z.object({
        day_of_week: z.number().int().min(1).max(7),
        start_time: z.string(),
        end_time: z.string(),
    })),
});

// --- QUERIES ---
export function useHorario(professionalId: string | null) {
    return useQuery({
        queryKey: [HORARIOS_QUERY_KEY, professionalId],
        queryFn: async () => {
            if (!professionalId) return { slots: [] as ScheduleSlot[], exceptions: [] as ScheduleException[] };

            const todayIso = new Date().toISOString().split('T')[0];
            const proId = encodeURIComponent(professionalId);

            const [slots, exceptions] = await Promise.all([
                apiFetch<ScheduleSlot[]>(`/api/admin/professionals/${proId}/schedule`),
                apiFetch<ScheduleException[]>(`/api/admin/professionals/${proId}/exceptions?from=${todayIso}`),
            ]);

            return { slots: slots ?? [], exceptions: exceptions ?? [] };
        },
        enabled: Boolean(professionalId),
    });
}

// --- MUTATIONS ---
export function useCreateSlot() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: z.infer<typeof CreateSlotSchema>) => {
            CreateSlotSchema.parse(payload);
            return apiFetch('/api/admin/schedule-slots', { method: 'POST', body: payload });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [HORARIOS_QUERY_KEY, variables.professional_id] });
        },
    });
}

export function useDeleteSlot() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id }: { id: string; professional_id: string }) =>
            apiFetch(`/api/admin/schedule-slots/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [HORARIOS_QUERY_KEY, variables.professional_id] });
        },
    });
}

export function useCreateException() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: z.infer<typeof CreateExceptionSchema>) => {
            CreateExceptionSchema.parse(payload);
            const { professional_id, ...bodyData } = payload;
            return apiFetch(`/api/admin/professionals/${encodeURIComponent(professional_id)}/exceptions`, {
                method: 'POST',
                body: bodyData,
            });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [HORARIOS_QUERY_KEY, variables.professional_id] });
        },
    });
}

export function useDeleteException() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id }: { id: string; professional_id: string }) =>
            apiFetch(`/api/admin/schedule-exceptions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [HORARIOS_QUERY_KEY, variables.professional_id] });
        },
    });
}

export function useApplyDefaultSchedule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: z.infer<typeof ApplyDefaultScheduleSchema>) => {
            ApplyDefaultScheduleSchema.parse(payload);
            const { professional_id, slots } = payload;
            return apiFetch(`/api/admin/professionals/${encodeURIComponent(professional_id)}/schedule`, {
                method: 'PUT',
                body: { slots },
            });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [HORARIOS_QUERY_KEY, variables.professional_id] });
        },
    });
}
