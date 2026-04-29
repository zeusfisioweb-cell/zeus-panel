import { verifyCancelToken } from '@/lib/portal-token';
import { ConfirmCancellationClient } from './ConfirmCancellationClient';

interface PageProps {
    searchParams: Promise<{ token?: string }>;
}

export default async function CancelConfirmPage({ searchParams }: PageProps) {
    const { token } = await searchParams;

    if (!token) {
        return (
            <div className="portal-shell">
                <ResultPage status="error" message="Falta el token de cancelación." />
            </div>
        );
    }

    try {
        await verifyCancelToken(token);
    } catch {
        return (
            <div className="portal-shell">
                <ResultPage status="error" message="Link expirado o inválido." />
            </div>
        );
    }

    return (
        <div className="portal-shell">
            <ConfirmCancellationClient token={token} />
        </div>
    );
}

type ResultStatus = 'success' | 'error' | 'already-cancelled';

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

function ResultPage({ status, message }: { status: ResultStatus; message: string }) {
    return (
        <div className="portal-result">
            <div className={`portal-result__icon portal-result__icon--${status}`}>
                {ICONS[status]}
            </div>
            <h1 className="portal-result__title">{TITLES[status]}</h1>
            <p className="portal-result__subtitle">{message}</p>
            <a href="/portal/mis-citas" className="btn btn--primary">
                Ver mis citas
            </a>
        </div>
    );
}
