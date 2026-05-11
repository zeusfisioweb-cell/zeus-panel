import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8 bg-[var(--bg-base)]">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-3xl font-bold text-[var(--text-muted)]">
                404
            </div>
            <h1 className="text-2xl font-semibold text-[var(--text-main)] !m-0">
                Página no encontrada
            </h1>
            <p className="text-sm text-[var(--text-muted)] max-w-[360px] !m-0">
                La ruta que buscas no existe o fue eliminada.
            </p>
            <Link href="/" className="btn btn--primary">
                Volver al panel
            </Link>
        </div>
    );
}
