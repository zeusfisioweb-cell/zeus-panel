import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Professional } from '@/lib/types';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

export const PROFESSIONALS_QUERY_KEY = ['profesionales'];

const createProfessionalPayloadSchema = z.object({
    email: z.string().email(),
    full_name: z.string().min(3),
    specialty: z.string().optional(),
    bio: z.string().optional(),
    color_code: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/, { message: 'Color inválido (ej: #3B82F6)' }).optional(),
    is_active: z.boolean().optional(),
    serviceIds: z.array(z.string()).min(1),
    scheduleSlots: z.array(z.object({
        day_of_week: z.number().int().min(1).max(7),
        start_time: z.string().min(1),
        end_time: z.string().min(1),
    })).optional(),
});

interface CreateProfessionalPayload {
    email: string;
    full_name: string;
    specialty?: string;
    bio?: string;
    color_code?: string;
    is_active?: boolean;
    serviceIds: string[];
    scheduleSlots?: Array<{
        day_of_week: number;
        start_time: string;
        end_time: string;
    }>;
}

interface UpdateProfessionalPayload {
    id: string;
    full_name?: string;
    email?: string;
    specialty?: string;
    bio?: string;
    color_code?: string;
    is_active?: boolean;
    avatar_url?: string | null;
    serviceIds?: string[];
}


export function useProfesionales() {
    return useQuery({
        queryKey: PROFESSIONALS_QUERY_KEY,
        queryFn: async () => {
            const data = await apiFetch<unknown[]>('/api/admin/professionals');

            return (data || []).map((row: unknown) => {
                const d = row as Record<string, unknown>;
                const profile = d.profile as Record<string, unknown> | Record<string, unknown>[] | null | undefined;

                return {
                    id: d.id as string,
                    specialty: (d.specialty as string | null) ?? null,
                    license_number: (d.license_number as string | null) ?? null,
                    bio: (d.bio as string | null) ?? null,
                    color_code: (d.color_code as string) ?? '#AD7332',
                    avatar_url: (d.avatar_url as string | null) ?? null,
                    is_active: Boolean(d.is_active),
                    created_at: d.created_at as string,
                    profile: Array.isArray(profile) ? profile[0] : profile,
                    professional_services: Array.isArray(d.professional_services)
                        ? (d.professional_services as Array<{ service_id: string }>)
                        : [],
                };
            }) as Professional[];
        },
    });
}

export function useCreateProfesional() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateProfessionalPayload) => {
            const parsed = createProfessionalPayloadSchema.parse(payload);
            return apiFetch<{ user_id: string }>('/api/admin/create-professional', {
                method: 'POST',
                body: {
                    email: parsed.email,
                    full_name: parsed.full_name,
                    specialty: parsed.specialty || null,
                    bio: parsed.bio || null,
                    color_code: parsed.color_code || '#AD7332',
                    is_active: parsed.is_active ?? true,
                    service_ids: parsed.serviceIds,
                    schedule_slots: parsed.scheduleSlots || [],
                },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}

export function useUpdateProfesional() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, serviceIds, ...professionalData }: UpdateProfessionalPayload) =>
            apiFetch<{ success: boolean }>('/api/admin/professionals', {
                method: 'PATCH',
                body: { id, serviceIds, ...professionalData },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}

export function useDeleteProfesional() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            apiFetch<{ success: boolean; reassignedAppointments: number }>('/api/admin/professionals', {
                method: 'DELETE',
                body: { id },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}
