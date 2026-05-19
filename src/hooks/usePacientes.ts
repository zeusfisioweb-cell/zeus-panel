import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Patient } from '@/lib/types';
import { readApiError } from '@/lib/api-helpers';

export const PATIENTS_QUERY_KEY = ['pacientes'];


export function usePacientes(options?: { searchTerm?: string; page?: number; pageSize?: number }) {
    const { searchTerm = '', page = 1, pageSize = 50 } = options || {};

    return useQuery({
        queryKey: [...PATIENTS_QUERY_KEY, { searchTerm, page, pageSize }],
        queryFn: async () => {
            const params = new URLSearchParams({
                search: searchTerm,
                page: String(page),
                pageSize: String(pageSize),
            });

            const response = await fetch(`/api/admin/patients?${params.toString()}`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const payload = (await response.json()) as { data: Patient[]; count: number; consentCount: number };
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
        mutationFn: async (newPatient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => {
            const response = await fetch('/api/admin/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(newPatient),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Patient;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
        },
    });
}

export function useUpdatePaciente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: Partial<Patient> & { id: string }) => {
            const response = await fetch('/api/admin/patients', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ id, ...updateData }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as Patient;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
        },
    });
}

export function useDeletePaciente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`/api/admin/patients/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
        },
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

export function usePatientsGrowth(period: PatientGrowthPeriod = 'month') {
    return useQuery({
        queryKey: ['patients-growth', period],
        queryFn: async () => {
            const response = await fetch(`/api/admin/patients/growth?period=${period}`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const payload = (await response.json()) as {
                points: PatientGrowthPoint[];
                period: PatientGrowthPeriod;
                kpis?: {
                    total: number;
                    gdprConsentRate: number;
                    marketingConsentRate: number;
                };
            };
            return payload;
        },
        staleTime: 5 * 60 * 1000, // 5 min
    });
}
