'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import {
    PANEL_NAV_ITEMS,
    canRenderNavItem,
    isPanelNavLink,
    isPanelNavSection,
} from '@/lib/panel-navigation';
import { useAppointmentRequestsPendingCount } from '@/hooks/useAppointmentRequests';
import { BRAND_NAME, BRAND_SHORT } from '@/branding';

export default function Sidebar() {
    const pathname = usePathname();
    const { profile, signOut } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { data: pendingRequestsCount = 0 } = useAppointmentRequestsPendingCount();

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const navHrefs = PANEL_NAV_ITEMS
        .filter(isPanelNavLink)
        .map((item) => item.href);

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        if (!pathname.startsWith(href)) return false;
        const moreSpecific = navHrefs.some(
            (other) => other !== href && other.startsWith(href + '/') && pathname.startsWith(other)
        );
        return !moreSpecific;
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
                            src="/intelidatia-logo-white.png"
                            alt="Intelidatia"
                            width={160}
                            height={36}
                            style={{ width: 'auto', height: '26px', objectFit: 'contain' }}
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

                <div className="sidebar__overview mx-3 mb-5 p-3 rounded-xl">
                    <span className="sidebar__overview-label font-extrabold">ESTADO</span>
                    <strong className="sidebar__overview-title text-[13px]">{BRAND_NAME}</strong>
                    <span className="sidebar__overview-meta flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-main)]" />
                        Clínica activa
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
                            const badge = item.badgeKey === 'appointmentRequestsPending' && pendingRequestsCount > 0
                                ? pendingRequestsCount
                                : null;

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
                                    {badge !== null && (
                                        <span
                                            className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold"
                                            aria-label={`${badge} solicitudes pendientes`}
                                        >
                                            {badge > 99 ? '99+' : badge}
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
                        <div
                            className="sidebar__user-avatar sidebar__user-avatar--sm"
                            style={{ background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)', color: '#95d5b2', border: '1px solid rgba(149,213,178,0.3)' }}
                        >
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
