'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export default function Providers({ children }: { children: React.ReactNode; nonce?: string }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Realtime subscriptions drive cache invalidation, so widen the windows.
                        staleTime: 60 * 1000,
                        gcTime: 5 * 60 * 1000,
                        refetchOnWindowFocus: false,
                        refetchOnReconnect: 'always',
                        retry: 1,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SHOW_DEVTOOLS === 'true' ? (
                <ReactQueryDevtools initialIsOpen={false} />
            ) : null}
        </QueryClientProvider>
    );
}
