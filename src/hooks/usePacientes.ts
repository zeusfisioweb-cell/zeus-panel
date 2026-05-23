import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Patient } from '@/lib/types';
import { apiFetch, buildSearchParams } from '@/lib/api-client';

export const PATIENTS_QUERY_KEY = ['pacientes'];


export function usePacientes(options?: { searchTerm?: string; page?: number; pageSize?: number }) {
    const { searchTerm = '', page = 1, pageSize = 50 } = options || {};

    return useQuery({
        queryKey: [...PATIENTS_QUERY_KEY, { searchTerm, page, pageSize }],
        queryFn: async () => {
            const qs = buildSearchParams({ search: searchTerm, page, pageSize });
            const payload = await apiFetch<{ data: Patient[]; count: number; consentCount: number }>(
                `/api/admin/patients${qs}`,
            );
            return {
                data: payload.data ?? [],
                count: payload.count ?? 0,
                consentCount: payload.consentCount ?? 0,
            };
        },
        placeholderData: keepPreviousData,
    });
}

export function useCreatePaciente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (newPatient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) =>
            apiFetch<Patient>('/api/admin/patients', { method: 'POST', body: newPatient }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
        },
    });
}

export function useUpdatePaciente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, ...updateData }: Partial<Patient> & { id: string }) =>
            apiFetch<Patient>('/api/admin/patients', {
                method: 'PATCH',
                body: { id, ...updateData },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
        },
    });
}

export function useDeletePaciente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            apiFetch<void>(`/api/admin/patients/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
        },
    });
}

export type PatientGrowthPeriod = 'week' | 'month' | 'year';

export interface PatientGrowthPoint {
    label: string;
    key: string;
    new_patients: number;
    total_patients: number;
}

interface PatientGrowthResponse {
    points: PatientGrowthPoint[];
    period: PatientGrowthPeriod;
    kpis?: {
        total: number;
        gdprConsentRate: number;
        marketingConsentRate: number;
    };
}

export function usePatientsGrowth(period: PatientGrowthPeriod = 'month') {
    return useQuery({
        queryKey: ['patients-growth', period],
        queryFn: () => apiFetch<PatientGrowthResponse>(`/api/admin/patients/growth?period=${period}`),
        staleTime: 5 * 60 * 1000,
    });
}
