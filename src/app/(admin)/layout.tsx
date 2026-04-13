'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Toaster } from 'sonner';
import { getPanelSectionTitle, isRestrictedForProfessional } from '@/lib/panel-navigation';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [profileStuck, setProfileStuck] = useState(false);
    const [loadingStuck, setLoadingStuck] = useState(false);

    const sectionTitle = getPanelSectionTitle(pathname);
    const isSummaryRoute = pathname === '/';

    useEffect(() => {
        if (loading) return;

        if (!user) {
            if (pathname !== '/login') router.replace('/login');
            return;
        }

        if (profile) {
            if (profile.role !== 'owner' && profile.role !== 'professional') {
                if (pathname !== '/login') router.replace('/login');
                return;
            }

            if (profile.role === 'professional') {
                if (pathname !== '/' && isRestrictedForProfessional(pathname)) {
                    router.replace('/');
                }
            }
        }

    }, [user, profile, loading, profileError, router, pathname]);

    useEffect(() => {
        if (loading || !user || profile || profileError) {
            setProfileStuck(false);
            return;
        }

        const timer = setTimeout(() => {
            setProfileStuck(true);
        }, 7000);

        return () => clearTimeout(timer);
    }, [loading, user, profile, profileError]);

    useEffect(() => {
        if (!loading) {
            setLoadingStuck(false);
            return;
        }

        const timer = setTimeout(() => {
            setLoadingStuck(true);
        }, 12000);

        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) {
        if (loadingStuck) {
            return (
                <div className="loading-page">
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
                        La carga del panel esta tardando demasiado.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => {
                                setLoadingStuck(false);
                                router.refresh();
                            }}
                            className="btn btn--secondary btn--sm"
                        >
                            Reintentar
                        </button>
                        <button
                            onClick={async () => {
                                await signOut();
                                router.replace('/login');
                            }}
                            className="btn btn--primary btn--sm"
                        >
                            Ir al login
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando panel...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Redirigiendo...</p>
            </div>
        );
    }

    if (!profile && profileError) {
        return (
            <div className="loading-page">
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
                    Error al cargar el perfil de usuario.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => {
                            void refreshProfile();
                        }}
                        className="btn btn--secondary btn--sm"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={async () => {
                            await signOut();
                            router.replace('/login');
                        }}
                        className="btn btn--primary btn--sm"
                    >
                        Ir al login
                    </button>
                </div>
            </div>
        );
    }

    if (!profile) {
        if (profileStuck) {
            return (
                <div className="loading-page">
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
                        No se pudo cargar el perfil. Vuelve a iniciar sesion.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => {
                                void refreshProfile();
                            }}
                            className="btn btn--secondary btn--sm"
                        >
                            Reintentar
                        </button>
                        <button
                            onClick={async () => {
                                await signOut();
                                router.replace('/login');
                            }}
                            className="btn btn--primary btn--sm"
                        >
                            Ir al login
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando perfil...</p>
            </div>
        );
    }

    if (profile.role !== 'owner' && profile.role !== 'professional') {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin permisos. Redirigiendo...</p>
            </div>
        );
    }

    if (profile.role === 'professional') {
        if (isRestrictedForProfessional(pathname)) {
            return (
                <div className="loading-page">
                    <div className="spinner" />
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Area restringida. Volviendo al inicio...</p>
                </div>
            );
        }
    }

    return (
        <div className={`admin-shell admin-shell--modern${isSummaryRoute ? ' admin-shell--summary' : ''}`}>
            <Sidebar />
            <main className="main-content">
                {!isSummaryRoute && (
                    <div className="panel-topbar panel-topbar--modern">
                        <div className="panel-topbar__primary">
                            <span className="panel-topbar__kicker">Panel Zeus</span>
                            <strong className="panel-topbar__title">{sectionTitle}</strong>
                        </div>
                        <div className="panel-topbar__meta">
                            <div className="panel-topbar__date-block">
                                <span className="panel-topbar__date-label">Hoy</span>
                                <span className="panel-topbar__date">
                                    {new Date().toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        day: '2-digit',
                                        month: 'long',
                                    })}
                                </span>
                            </div>
                            <div className="panel-topbar__user-block">
                                <span className="panel-topbar__role">
                                    {profile.role === 'owner' ? 'Direccion' : 'Profesional'}
                                </span>
                                <strong className="panel-topbar__name">{profile.full_name || 'Usuario'}</strong>
                            </div>
                        </div>
                    </div>
                )}
                {children}
            </main>
            <Toaster
                position="top-right"
                richColors
                toastOptions={{
                    style: {
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                    },
                    className: 'font-sans',
                }}
            />
        </div>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AdminLayoutInner>{children}</AdminLayoutInner>;
}
