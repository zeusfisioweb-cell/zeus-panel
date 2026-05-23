import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Service, ServiceCategory } from '@/lib/types';
import { ServiceSchema, ServiceUpdateSchema } from '@/lib/schemas';
import { apiFetch } from '@/lib/api-client';

export class ServiceHasAppointmentsError extends Error {
    count: number;
    constructor(count: number, message: string) {
        super(message);
        this.name = 'ServiceHasAppointmentsError';
        this.count = count;
    }
}

export const SERVICES_QUERY_KEY = ['servicios'];
export const CATEGORIES_QUERY_KEY = ['categorias'];


export function useCategorias() {
    return useQuery({
        queryKey: CATEGORIES_QUERY_KEY,
        queryFn: () => apiFetch<ServiceCategory[]>('/api/admin/service-categories'),
    });
}

export function useServicios() {
    return useQuery({
        queryKey: SERVICES_QUERY_KEY,
        queryFn: () => apiFetch<Service[]>('/api/admin/services'),
    });
}

export function useCreateServicio() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (newService: Omit<Service, 'id' | 'created_at' | 'category'>) => {
            ServiceSchema.parse(newService);
            return apiFetch<Service>('/api/admin/services', { method: 'POST', body: newService });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}

export function useUpdateServicio() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, ...updateData }: Partial<Service> & { id: string }) => {
            ServiceUpdateSchema.parse(updateData);
            return apiFetch<Service>('/api/admin/services', {
                method: 'PATCH',
                body: { id, ...updateData },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}

export function useDeleteServicio() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
            // Custom 409 path: surface ServiceHasAppointmentsError so UI can prompt force-confirm.
            const response = await fetch('/api/admin/services', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id, force: force ?? false }),
            });

            if (response.status === 409) {
                const body = (await response.json().catch(() => null)) as
                    | { error?: string; count?: number; requiresConfirmation?: boolean }
                    | null;
                if (body?.requiresConfirmation) {
                    throw new ServiceHasAppointmentsError(
                        Number(body.count ?? 0),
                        body.error ?? 'El servicio tiene citas futuras',
                    );
                }
                throw new Error(body?.error ?? 'Conflicto');
            }

            if (!response.ok) {
                const { readApiError } = await import('@/lib/api-helpers');
                throw new Error(await readApiError(response));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['citas'] });
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
        },
    });
}
