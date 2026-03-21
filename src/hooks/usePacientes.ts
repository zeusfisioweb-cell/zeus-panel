import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Patient } from '@/lib/types';
import { logAuditEvent } from '@/lib/audit';
import { PatientSchema, PatientUpdateSchema } from '@/lib/schemas';

export const PATIENTS_QUERY_KEY = ['pacientes'];

export function usePacientes(options?: { searchTerm?: string; page?: number; pageSize?: number }) {
    const supabase = createClient();
    const { searchTerm = '', page = 1, pageSize = 50 } = options || {};

    return useQuery({
        // Incluimos opciones en el queryKey para que react-query re-ejecute y cachee por separado
        queryKey: [...PATIENTS_QUERY_KEY, { searchTerm, page, pageSize }],
        queryFn: async () => {
            let query = supabase
                .from('patients')
                .select('*', { count: 'exact' });

            if (searchTerm) {
                // Buscamos coincidencia parcial en nombre, apellido o rut
                query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,rut.ilike.%${searchTerm}%`);
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, count, error } = await query
                .order('first_name')
                .range(from, to);

            if (error) throw error;
            return { data: data as Patient[], count: count || 0 };
        },
    });
}

export function useCreatePaciente() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newPatient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => {
            PatientSchema.parse(newPatient);

            const { data, error } = await supabase
                .from('patients')
                .insert([newPatient])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
            logAuditEvent({ action: 'CREATE', table_name: 'patients', record_id: data.id });
        },
    });
}

export function useUpdatePaciente() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: Partial<Patient> & { id: string }) => {
            PatientUpdateSchema.parse(updateData);

            const { data, error } = await supabase
                .from('patients')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
            logAuditEvent({ action: 'UPDATE', table_name: 'patients', record_id: data.id });
        },
    });
}

export function useDeletePaciente() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // Uses a PostgreSQL RPC function that runs as a single transaction.
            // Cascades: clinical_records → delete, consent_records → delete,
            // appointments → patient_id set to NULL (history preserved), patient → delete.
            const { error } = await supabase
                .rpc('delete_patient_cascade', { p_id: id });

            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
            logAuditEvent({ action: 'DELETE', table_name: 'patients', record_id: id });
        },
    });
}
