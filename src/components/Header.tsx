'use client';

import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps {
    onToggleSidebar?: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
    const { profile } = useAuth();
    const firstName = profile?.full_name?.split(' ')[0] || 'Usuario';

    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Buenas noches';
    if (hour >= 6 && hour < 12) greeting = 'Buenos días';
    else if (hour >= 12 && hour < 20) greeting = 'Buenas tardes';

    const dateStr = now.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
    });

    return (
        <header className="header">
            <div className="header__left">
                <button
                    className="mobile-menu-btn"
                    onClick={onToggleSidebar}
                    aria-label="Menú"
                >
                    <Icon name="search" size={18} /> {/* Using as a placeholder for hamburger since menu icon is missing */}
                </button>
                <div className="header__greeting">
                    {greeting}, <strong>{firstName}</strong> <span style={{ color: 'var(--border-color)', margin: '0 8px' }}>|</span> {dateStr}
                </div>
            </div>

            <div className="header__right">
                <div className="header__search">
                    <span className="header__search-icon">
                        <Icon name="search" size={14} />
                    </span>
                    <input
                        className="header__search-input"
                        placeholder="Buscar pacientes, citas..."
                        type="text"
                        readOnly
                    />
                </div>
                <button className="header__icon-btn" aria-label="Notificaciones">
                    <Icon name="bell" size={18} />
                    <span className="header__notification-dot" />
                </button>
            </div>
        </header>
    );
}
