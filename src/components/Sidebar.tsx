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
        const response = await fetch('/api/admin/appointments/pending-count', {
            method: 'GET',
            credentials: 'same-origin',
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { count?: number };
        setPendingCount(payload.count ?? 0);
    }, []);

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
            ? 'Admin'
            : profile?.role === 'professional'
                ? 'Profesional'
                : 'Cliente';

    return (
        <>
            <button
                className="sidebar-mobile-toggle"
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
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
                            alt="Zeus Clínica"
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
                        aria-label="Cerrar menú"
                    >
                        <Icon name="close" size={18} />
                    </button>
                </div>

                <div className="sidebar__overview" style={{ background: 'rgba(173, 115, 50, 0.05)', margin: '0 12px 20px', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(173, 115, 50, 0.12)' }}>
                    <span className="sidebar__overview-label" style={{ color: 'var(--brand-main)', fontWeight: 800 }}>ESTADO</span>
                    <strong className="sidebar__overview-title" style={{ fontSize: '13px' }}>Fisioterapia Zeus</strong>
                    <span className="sidebar__overview-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pendingCount > 0 ? 'var(--warning-main)' : 'var(--success-main)' }} />
                        {pendingCount > 0 ? `${pendingCount} citas pendientes` : 'Al día'}
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
                            title="Cerrar sesión"
                            aria-label="Cerrar sesión"
                        >
                            <Icon name="logout" size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
