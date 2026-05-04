'use client';

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/client';
import { getAppointmentRealtimeNotification } from '@/lib/appointment-notifications';

type RealtimeRecord = Record<string, unknown>;

export function AppointmentRealtimeNotifications() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        if (!profile) return;

        const channel = supabase
            .channel('panel-appointments-notifications')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                (payload: RealtimePostgresChangesPayload<RealtimeRecord>) => {
                    const notification = getAppointmentRealtimeNotification({
                        eventType: payload.eventType,
                        new: payload.new,
                        old: payload.old,
                    });

                    if (notification) {
                        toast.success(notification.title, {
                            description: notification.description,
                            duration: 6000,
                        });
                    }

                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [supabase, profile, queryClient]);

    return null;
}
