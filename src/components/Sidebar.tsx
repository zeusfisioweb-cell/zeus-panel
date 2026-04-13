'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import {
    PANEL_NAV_ITEMS,
    canRenderNavItem,
    isPanelNavLink,
    isPanelNavSection,
} from '@/lib/panel-navigation';

export default function Sidebar() {
    const pathname = usePathname();
    const { profile, signOut } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const [supabase] = useState(() => createClient());
    const [mobileOpen, setMobileOpen] = useState(false);

    const loadPending = useCallback(async () => {
        const { count } = await supabase
            .from('appointments')
            .select('id', { count: 'exact' })
            .eq('status', 'pending')
            .is('deleted_at' as never, null); // future-proofing
        setPendingCount(count || 0);
    }, [supabase]);

    useEffect(() => {
        // Initial load
        loadPending();

        // Real-time subscription instead of polling — updates instantly on any appointment change
        const channel = supabase
            .channel('sidebar-pending')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                void loadPending();
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    // loadPending and supabase are stable (useCallback + useState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    const initials = profile?.full_name
        ? profile.full_name
            .split(' ')
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase()
        : 'AZ';

    const roleLabel =
        profile?.role === 'owner'
            ? 'Direccion'
            : profile?.role === 'professional'
                ? 'Profesional'
                : 'Cliente';

    return (
        <>
            <button
                className="sidebar-mobile-toggle"
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
            >
                <Icon name="menu" size={22} />
            </button>

            {mobileOpen && (
                <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
                <div className="sidebar__brand">
                    <div className="sidebar__brand-image">
                        <Image
                            src="/zeusheader.webp"
                            alt="Zeus Clinica"
                            width={200}
                            height={60}
                            style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '60px', objectFit: 'contain' }}
                            priority
                        />
                    </div>
                    <button
                        className="sidebar__close-mobile"
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Cerrar menu"
                    >
                        <Icon name="close" size={18} />
                    </button>
                </div>

                <div className="sidebar__overview">
                    <span className="sidebar__overview-label">Operacion</span>
                    <strong className="sidebar__overview-title">Control diario</strong>
                    <span className="sidebar__overview-meta">
                        {pendingCount > 0 ? `${pendingCount} pendientes` : 'Sin pendientes'}
                    </span>
                </div>

                <nav className="sidebar__nav">
                    {PANEL_NAV_ITEMS.map((item, i) => {
                        if (!canRenderNavItem(item, profile?.role)) return null;

                        if (isPanelNavSection(item)) {
                            return (
                                <div key={i} className="sidebar__section-title">
                                    {item.section}
                                </div>
                            );
                        }

                        if (isPanelNavLink(item)) {
                            const active = isActive(item.href);
                            const hasBadge = Boolean(item.showBadge && pendingCount > 0);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
                                >
                                    <span className="sidebar__link-icon">
                                        <Icon name={item.icon} size={18} />
                                    </span>
                                    <span className="sidebar__link-label">{item.label}</span>
                                    {hasBadge && (
                                        <span className="sidebar__badge" aria-label={`${pendingCount} citas pendientes`}>
                                            {pendingCount > 9 ? '9+' : pendingCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        }

                        return null;
                    })}
                </nav>

                <div className="sidebar__footer sidebar__footer--compact">
                    <div className="sidebar__user sidebar__user--compact">
                        <div className="sidebar__user-avatar sidebar__user-avatar--sm">
                            <span>{initials}</span>
                        </div>
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-name">
                                {profile?.full_name || 'Usuario'}
                            </div>
                            <div className="sidebar__user-role">
                                {roleLabel}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={signOut}
                            className="sidebar__logout-icon"
                            title="Cerrar sesion"
                            aria-label="Cerrar sesion"
                        >
                            <Icon name="logout" size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
