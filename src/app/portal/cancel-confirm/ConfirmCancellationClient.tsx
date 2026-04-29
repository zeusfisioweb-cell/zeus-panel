'use client';

import { useState } from 'react';

type ResultStatus = 'success' | 'error' | 'already-cancelled';
type ViewState = ResultStatus | 'idle' | 'submitting';

const ICONS: Record<ResultStatus, string> = {
    success: '✓',
    error: '✕',
    'already-cancelled': 'i',
};

const TITLES: Record<ResultStatus, string> = {
    success: 'Cita cancelada',
    error: 'Algo salió mal',
    'already-cancelled': 'Cita ya cancelada',
};

interface Props {
    token: string;
}

export function ConfirmCancellationClient({ token }: Props) {
    const [state, setState] = useState<ViewState>('idle');
    const [message, setMessage] = useState('Confirma que quieres cancelar esta cita.');

    async function handleConfirm() {
        try {
            setState('submitting');
            const response = await fetch('/api/portal/appointments/cancel-confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setMessage(payload.error ?? 'No fue posible procesar la cancelación. Inténtalo de nuevo.');
                setState('error');
                return;
            }

            if (payload.status === 'already-cancelled') {
                setMessage('Esta cita ya fue cancelada o no está disponible para cancelar.');
                setState('already-cancelled');
                return;
            }

            setMessage('Tu cita ha sido cancelada correctamente.');
            setState('success');
        } catch {
            setMessage('No fue posible procesar la cancelación. Inténtalo de nuevo.');
            setState('error');
        }
    }

    if (state === 'idle' || state === 'submitting') {
        return (
            <div className="portal-result">
                <div className="portal-result__icon portal-result__icon--already-cancelled">i</div>
                <h1 className="portal-result__title">Confirmar cancelación</h1>
                <p className="portal-result__subtitle">{message}</p>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleConfirm}
                    disabled={state === 'submitting'}
                >
                    {state === 'submitting' ? 'Procesando...' : 'Confirmar cancelación'}
                </button>
                <a href="/portal/mis-citas" className="btn">
                    Volver a mis citas
                </a>
            </div>
        );
    }

    return (
        <div className="portal-result">
            <div className={`portal-result__icon portal-result__icon--${state}`}>
                {ICONS[state]}
            </div>
            <h1 className="portal-result__title">{TITLES[state]}</h1>
            <p className="portal-result__subtitle">{message}</p>
            <a href="/portal/mis-citas" className="btn btn--primary">
                Ver mis citas
            </a>
        </div>
    );
}
