'use client';

import { useEffect } from 'react';
import Icon from '@/components/Icon';

export default function ProfesionalesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error en página de Profesionales:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--danger-bg)] flex items-center justify-center">
                <Icon name="alert-triangle" size={24} className="text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-main)] !m-0">
                Error al cargar profesionales
            </h2>
            <p className="text-sm text-[var(--text-muted)] !m-0 text-center">
                {error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'}
            </p>
            <button onClick={reset} className="btn btn--primary mt-2">
                Reintentar
            </button>
        </div>
    );
}
