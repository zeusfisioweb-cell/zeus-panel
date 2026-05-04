import { useQuery } from '@tanstack/react-query';
import type { BookingSettings } from '@/lib/types';
import { readApiError } from '@/lib/api-helpers';


export function useSettings() {
    return useQuery({
        queryKey: ['booking_settings'],
        queryFn: async () => {
            const response = await fetch('/api/admin/booking-settings', {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            return (await response.json()) as BookingSettings;
        },
        staleTime: 5 * 60 * 1000,
    });
}