import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Professional } from '@/lib/types';
import { z } from 'zod';
import { readApiError } from '@/lib/api-helpers';

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
    specialty?: string;
    bio?: string;
    color_code?: string;
    is_active?: boolean;
    serviceIds?: string[];
}


export function useProfesionales() {
    return useQuery({
        queryKey: PROFESSIONALS_QUERY_KEY,
        queryFn: async () => {
            const response = await fetch('/api/admin/professionals', {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const data = (await response.json()) as unknown[];

            return (data || []).map((row: unknown) => {
                const d = row as Record<string, unknown>;
                const profile = d.profile as Record<string, unknown> | Record<string, unknown>[] | null | undefined;

                return {
                    id: d.id as string,
                    specialty: (d.specialty as string | null) ?? null,
                    license_number: (d.license_number as string | null) ?? null,
                    bio: (d.bio as string | null) ?? null,
                    color_code: (d.color_code as string) ?? '#AD7332',
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
        mutationFn: async (payload: CreateProfessionalPayload) => {
            const parsedPayload = createProfessionalPayloadSchema.parse(payload);

            // temp_password is now generated server-side for security.
            const response = await fetch('/api/admin/create-professional', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    email: parsedPayload.email,
                    full_name: parsedPayload.full_name,
                    specialty: parsedPayload.specialty || null,
                    bio: parsedPayload.bio || null,
                    color_code: parsedPayload.color_code || '#AD7332',
                    is_active: parsedPayload.is_active ?? true,
                    service_ids: parsedPayload.serviceIds,
                    schedule_slots: parsedPayload.scheduleSlots || [],
                }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const result = (await response.json()) as { user_id: string };
            return { user_id: result.user_id };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}

export function useUpdateProfesional() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, serviceIds, ...professionalData }: UpdateProfessionalPayload) => {
            const response = await fetch('/api/admin/professionals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id, serviceIds, ...professionalData }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as { success: boolean };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}

export function useDeleteProfesional() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch('/api/admin/professionals', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as { success: boolean; reassignedAppointments: number };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}
