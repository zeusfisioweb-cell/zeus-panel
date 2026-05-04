import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Service, ServiceCategory } from '@/lib/types';
import { ServiceSchema, ServiceUpdateSchema } from '@/lib/schemas';
import { readApiError } from '@/lib/api-helpers';

export const SERVICES_QUERY_KEY = ['servicios'];
export const CATEGORIES_QUERY_KEY = ['categorias'];


export function useCategorias() {
    return useQuery({
        queryKey: CATEGORIES_QUERY_KEY,
        queryFn: async () => {
            const response = await fetch('/api/admin/service-categories', {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as ServiceCategory[];
        },
    });
}

export function useServicios() {
    return useQuery({
        queryKey: SERVICES_QUERY_KEY,
        queryFn: async () => {
            const response = await fetch('/api/admin/services', {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Service[];
        },
    });
}

export function useCreateServicio() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newService: Omit<Service, 'id' | 'created_at' | 'category'>) => {
            ServiceSchema.parse(newService);

            const response = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(newService),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Service;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}

export function useUpdateServicio() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: Partial<Service> & { id: string }) => {
            ServiceUpdateSchema.parse(updateData);

            const response = await fetch('/api/admin/services', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id, ...updateData }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Service;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}

export function useDeleteServicio() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch('/api/admin/services', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}