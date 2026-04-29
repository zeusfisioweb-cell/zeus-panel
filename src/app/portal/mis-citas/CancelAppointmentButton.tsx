'use client';

import { useState } from 'react';
import { computeCancellationDeadline } from '@/lib/booking-validation';

interface Props {
  aptId: string;
  startTime: string;       // ISO
  serviceName: string;
  cancellationHours: number;
}

type State = 'idle' | 'confirming' | 'sending' | 'sent' | 'error';

function formatDeadline(date: Date): string {
  return date.toLocaleString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CancelAppointmentButton({
  aptId,
  startTime,
  serviceName,
  cancellationHours,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const deadline = computeCancellationDeadline(startTime, cancellationHours);
  const canStillCancel = new Date() <= deadline;

  if (!canStillCancel) return null;

  async function handleConfirm() {
    setState('sending');
    setErrorMessage('');
    try {
      const res = await fetch(`/api/portal/appointments/${aptId}/cancel`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setState('sent');
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErrorMessage(body.error ?? 'Ha ocurrido un error. Inténtalo de nuevo.');
        setState('error');
      }
    } catch {
      setErrorMessage('No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <p className="portal-cancel-inline portal-cancel-inline--success">
        ✓ Email de confirmación enviado a tu correo
      </p>
    );
  }

  if (state === 'error') {
    return (
      <p className="portal-cancel-inline portal-cancel-inline--error">
        {errorMessage}
        <button
          type="button"
          className="portal-cancel-retry-btn"
          onClick={() => setState('idle')}
        >
          Reintentar
        </button>
      </p>
    );
  }

  return (
    <>
      {state === 'idle' && (
        <button
          type="button"
          className="portal-cancel-btn"
          onClick={() => setState('confirming')}
        >
          Cancelar cita
        </button>
      )}

      {(state === 'confirming' || state === 'sending') && (
        <div className="portal-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
          <div
            className="portal-cancel-modal__overlay"
            onClick={() => { if (state !== 'sending') setState('idle'); }}
          />
          <div className="portal-cancel-modal__box">
            {state === 'sending' ? (
              <div className="portal-cancel-sent">
                <div className="portal-cancel-sent__icon">
                  <div className="spinner" style={{ width: 24, height: 24, borderColor: 'rgba(5,150,105,0.2)', borderTopColor: 'var(--success-main)' }} />
                </div>
                <p className="portal-cancel-sent__desc">Enviando solicitud de cancelación…</p>
              </div>
            ) : (
              <>
                <div className="portal-cancel-modal__header">
                  <h2 id="cancel-modal-title" className="portal-cancel-modal__title">
                    ¿Cancelar esta cita?
                  </h2>
                </div>

                <div className="portal-cancel-modal__body">
                  <div className="portal-cancel-modal__apt-info">
                    <strong>{serviceName}</strong>
                    <span>{formatStartTime(startTime)}</span>
                  </div>

                  <p className="portal-cancel-modal__deadline">
                    Te enviaremos un enlace a tu correo para confirmar la cancelación.
                    {' '}El enlace caduca en 24 horas.{' '}
                    <strong>Plazo máximo para cancelar: {formatDeadline(deadline)}</strong>
                  </p>
                </div>

                <div className="portal-cancel-modal__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setState('idle')}
                  >
                    No, volver
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    style={{ background: 'var(--danger-main)', borderColor: 'var(--danger-main)' }}
                    onClick={handleConfirm}
                  >
                    Sí, cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
