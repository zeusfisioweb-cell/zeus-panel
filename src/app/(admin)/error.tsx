'use client';

import { useEffect } from 'react';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to error reporting service in production
        console.error('[Admin Error]', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
            <div className="w-14 h-14 rounded-full bg-[var(--danger-bg)] flex items-center justify-center text-2xl">
                ⚠️
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-main)] !m-0">
                Algo salió mal
            </h2>
            <p className="text-sm text-[var(--text-muted)] max-w-[380px] !m-0">
                {error.message || 'Se produjo un error inesperado. Por favor, inténtalo de nuevo.'}
            </p>
            {error.digest && (
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                    Código: {error.digest}
                </p>
            )}
            <button
                className="btn btn--primary"
                onClick={reset}
            >
                Intentar de nuevo
            </button>
        </div>
    );
}
