'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!loading && profile && profile.role !== 'owner') {
            router.replace('/login');
        }
    }, [profile, loading, router]);

    // Show loading spinner while auth state is resolving
    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--gris)', fontSize: 13 }}>Cargando panel...</p>
            </div>
        );
    }

    // Not authenticated — redirect will happen via useEffect above
    if (!user) {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--gris)', fontSize: 13 }}>Redirigiendo...</p>
            </div>
        );
    }

    // User is authenticated but profile hasn't loaded yet or failed
    // Show loading state instead of blank page
    if (!profile) {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--gris)', fontSize: 13 }}>Cargando perfil...</p>
            </div>
        );
    }

    // User doesn't have the right role — redirect will happen via useEffect
    if (profile.role !== 'owner') {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--gris)', fontSize: 13 }}>Sin permisos. Redirigiendo...</p>
            </div>
        );
    }

    return (
        <>
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminLayoutInner>{children}</AdminLayoutInner>
    );
}
