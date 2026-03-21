import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { BookingSettings } from '@/lib/types';

// useSettings: createClient() is called inside queryFn, which runs
// in the React Query context (safe). No module-scope instantiation.
export function useSettings() {
    return useQuery({
        queryKey: ['booking_settings'],
        queryFn: async () => {
            // Creating client inside queryFn is acceptable for hooks
            // that don't need a stable client reference for subscriptions.
            const supabase = createClient();
            const { data, error } = await supabase
                .from('booking_settings')
                .select('*')
                .single();

            if (error) throw error;
            return data as BookingSettings;
        },
        staleTime: 5 * 60 * 1000, // Settings change rarely — cache for 5 minutes
    });
}
