import { Toaster } from 'sonner';
import type { ReactNode } from 'react';

export const metadata = {
    title: 'Portal del Paciente — Zeus',
};

export default function PortalLayout({ children }: { children: ReactNode }) {
    return (
        <div className="portal-shell">
            {children}
            <Toaster
                position="top-right"
                richColors
                toastOptions={{
                    style: {
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                    },
                }}
            />
        </div>
    );
}
