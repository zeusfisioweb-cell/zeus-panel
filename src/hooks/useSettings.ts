import { useQuery } from '@tanstack/react-query';
import type { BookingSettings } from '@/lib/types';

async function readApiError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { error?: string };
        return body.error || 'Error de servidor';
    } catch {
        return 'Error de servidor';
    }
}

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