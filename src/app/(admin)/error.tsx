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
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '16px',
            textAlign: 'center',
            padding: '32px',
        }}>
            <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
            }}>
                ⚠️
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Algo salió mal
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380, margin: 0 }}>
                {error.message || 'Se produjo un error inesperado. Por favor, inténtalo de nuevo.'}
            </p>
            {error.digest && (
                <p style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>
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
