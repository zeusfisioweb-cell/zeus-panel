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

export default function Sidebar() {
    const pathname = usePathname();
    const { profile, signOut } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

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

                <div className="sidebar__overview bg-[rgba(173,115,50,0.05)] mx-3 mb-5 p-3 rounded-xl border border-[rgba(173,115,50,0.12)]">
                    <span className="sidebar__overview-label text-[var(--brand-main)] font-extrabold">ESTADO</span>
                    <strong className="sidebar__overview-title text-[13px]">Fisioterapia Zeus</strong>
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
