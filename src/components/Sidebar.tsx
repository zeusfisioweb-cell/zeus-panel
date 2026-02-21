'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const supabase = createClient();

const NAV_ITEMS = [
    { section: 'General' },
    { href: '/', icon: 'dashboard', label: 'Dashboard' },
    { href: '/citas', icon: 'calendar', label: 'Citas', showBadge: true },
    { section: 'Gestión' },
    { href: '/profesionales', icon: 'doctor', label: 'Profesionales' },
    { href: '/servicios', icon: 'spa', label: 'Servicios' },
    { href: '/pacientes', icon: 'users', label: 'Pacientes' },
    { section: 'Configuración' },
    { href: '/horarios', icon: 'clock', label: 'Horarios' },
    { href: '/configuracion', icon: 'settings', label: 'Configuración' },
    { section: 'Legal' },
    { href: '/legal', icon: 'shield', label: 'Cumplimiento' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { profile, signOut } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        loadPending();
        // Refresh every 60 seconds
        const interval = setInterval(loadPending, 60_000);
        return () => clearInterval(interval);
    }, []);

    async function loadPending() {
        const { count } = await supabase
            .from('appointments')
            .select('id', { count: 'exact' })
            .eq('status', 'pending');
        setPendingCount(count || 0);
    }

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar__logo">
                <div className="sidebar__logo-icon">Z</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="sidebar__logo-text">Zeus</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -2, letterSpacing: 1 }}>WORKSPACE</span>
                </div>
            </div>

            <nav className="sidebar__nav">
                {NAV_ITEMS.map((item, i) => {
                    if ('section' in item && !('href' in item)) {
                        return (
                            <div key={i} className="sidebar__section-title">
                                {item.section}
                            </div>
                        );
                    }

                    if ('href' in item && item.href) {
                        const active = isActive(item.href as string);
                        const hasBadge = 'showBadge' in item && item.showBadge && pendingCount > 0;

                        return (
                            <Link
                                key={item.href}
                                href={item.href as string}
                                className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
                            >
                                <span className="sidebar__link-icon"><Icon name={item.icon as string} size={18} /></span>
                                {item.label}
                                {hasBadge && (
                                    <span className="sidebar__badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
                                )}
                            </Link>
                        );
                    }

                    return null;
                })}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__user">
                    <div className="sidebar__user-avatar">
                        {profile?.full_name?.charAt(0) || 'Z'}
                    </div>
                    <div className="sidebar__user-info">
                        <div className="sidebar__user-name">
                            {profile?.full_name || 'Administrador'}
                        </div>
                        <div className="sidebar__user-role">Propietario</div>
                    </div>
                </div>
                <button
                    onClick={signOut}
                    className="sidebar__link"
                    style={{ marginTop: 8 }}
                >
                    <span className="sidebar__link-icon"><Icon name="logout" size={18} /></span>
                    Cerrar sesión
                </button>
            </div>
        </aside>
    );
}
