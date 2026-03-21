import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Service, ServiceCategory } from '@/lib/types';
import { ServiceSchema, ServiceUpdateSchema } from '@/lib/schemas';

export const SERVICES_QUERY_KEY = ['servicios'];
export const CATEGORIES_QUERY_KEY = ['categorias'];

export function useCategorias() {
    const supabase = createClient();

    return useQuery({
        queryKey: CATEGORIES_QUERY_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('service_categories')
                .select('*')
                .order('display_order');

            if (error) throw error;
            return data as ServiceCategory[];
        },
    });
}

export function useServicios() {
    const supabase = createClient();

    return useQuery({
        queryKey: SERVICES_QUERY_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('services')
                .select(`
                    *,
                    category:service_categories (
                        id,
                        name,
                        color
                    )
                `)
                .order('name');

            if (error) throw error;
            return data as Service[];
        },
    });
}

export function useCreateServicio() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newService: Omit<Service, 'id' | 'created_at' | 'category'>) => {
            ServiceSchema.parse(newService);

            const { data, error } = await supabase
                .from('services')
                .insert([newService])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}

export function useUpdateServicio() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: Partial<Service> & { id: string }) => {
            ServiceUpdateSchema.parse(updateData);

            const { data, error } = await supabase
                .from('services')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}

export function useDeleteServicio() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
        },
    });
}
