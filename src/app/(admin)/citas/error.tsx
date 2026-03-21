'use client';

import { useEffect } from 'react';
import Icon from '@/components/Icon';

export default function CitasError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error en página de Citas:', error);
    }, [error]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 24px', gap: 16
        }}>
            <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--danger-bg)', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon name="alert-triangle" size={24} className="text-red-500" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Error al cargar las citas
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                {error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'}
            </p>
            <button
                onClick={reset}
                className="btn btn--primary"
                style={{ marginTop: 8 }}
            >
                Reintentar
            </button>
        </div>
    );
}
