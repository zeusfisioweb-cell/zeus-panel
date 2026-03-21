import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Professional } from '@/lib/types';
import { ProfessionalCreateSchema } from '@/lib/schemas';

export const PROFESSIONALS_QUERY_KEY = ['profesionales'];

interface CreateProfessionalPayload {
    email: string;
    full_name: string;
    specialty?: string;
    bio?: string;
    color_code?: string;
    is_active?: boolean;
    serviceIds: string[];
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
    const supabase = createClient();

    return useQuery({
        queryKey: PROFESSIONALS_QUERY_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('professionals')
                .select(`
                    id,
                    specialty,
                    license_number,
                    bio,
                    color_code,
                    is_active,
                    created_at,
                    profile:profiles (
                        id,
                        email,
                        role,
                        full_name,
                        created_at
                    ),
                    professional_services(service_id)
                `);

            if (error) throw error;

            return (data || []).map((d: any) => ({
                id: d.id,
                specialty: d.specialty,
                license_number: d.license_number,
                bio: d.bio,
                color_code: d.color_code,
                is_active: d.is_active,
                created_at: d.created_at,
                profile: Array.isArray(d.profile) ? d.profile[0] : d.profile,
                professional_services: d.professional_services
            })) as Professional[];
        },
    });
}

export function useCreateProfesional() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateProfessionalPayload) => {
            ProfessionalCreateSchema.parse(payload);

            // 1. Call API route to create auth user + profile (uses SERVICE_ROLE_KEY server-side)
            const tempPassword = crypto.randomUUID().slice(0, 16);
            const res = await fetch('/api/admin/create-professional', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: payload.email,
                    first_name: payload.full_name,
                    last_name: '',
                    temp_password: tempPassword,
                }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error al crear usuario');

            const userId = result.user_id;

            // 2. Create professional record
            const { error: profError } = await supabase
                .from('professionals')
                .insert([{
                    id: userId,
                    specialty: payload.specialty || null,
                    bio: payload.bio || null,
                    color_code: payload.color_code || '#AD7332',
                    is_active: payload.is_active ?? true,
                }]);

            if (profError) throw profError;

            // 3. Insert into professional_services junction table
            if (payload.serviceIds.length > 0) {
                const serviceRows = payload.serviceIds.map(serviceId => ({
                    professional_id: userId,
                    service_id: serviceId,
                }));
                const { error: svcError } = await supabase
                    .from('professional_services')
                    .insert(serviceRows);

                if (svcError) throw svcError;
            }

            return { user_id: userId };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}

export function useUpdateProfesional() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, serviceIds, ...professionalData }: UpdateProfessionalPayload) => {
            // Update profile if full_name provided
            if (professionalData.full_name) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ full_name: professionalData.full_name })
                    .eq('id', id);

                if (profileError) throw profileError;
            }

            // Update professional record
            const profUpdate: Record<string, unknown> = {};
            if (professionalData.specialty !== undefined) profUpdate.specialty = professionalData.specialty;
            if (professionalData.bio !== undefined) profUpdate.bio = professionalData.bio;
            if (professionalData.color_code !== undefined) profUpdate.color_code = professionalData.color_code;
            if (professionalData.is_active !== undefined) profUpdate.is_active = professionalData.is_active;

            if (Object.keys(profUpdate).length > 0) {
                const { error: profError } = await supabase
                    .from('professionals')
                    .update(profUpdate)
                    .eq('id', id);

                if (profError) throw profError;
            }

            // Update services: delete + re-insert
            if (serviceIds !== undefined) {
                const { error: delError } = await supabase
                    .from('professional_services')
                    .delete()
                    .eq('professional_id', id);

                if (delError) throw delError;

                if (serviceIds.length > 0) {
                    const serviceRows = serviceIds.map(serviceId => ({
                        professional_id: id,
                        service_id: serviceId,
                    }));
                    const { error: insError } = await supabase
                        .from('professional_services')
                        .insert(serviceRows);

                    if (insError) throw insError;
                }
            }

            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}

export function useDeleteProfesional() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('professionals')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
        },
    });
}
