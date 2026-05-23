'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/Icon';

const SW_PATH = '/push-sw.js';
const DISMISS_KEY = 'zeus_push_prompt_dismissed';

type Status = 'loading' | 'unsupported' | 'ios-need-pwa' | 'denied' | 'inactive' | 'active';

function base64ToUint8Array(base64: string): Uint8Array {
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(normalized + padding);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
        bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
}

function isIosDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

function isStandaloneDisplay(): boolean {
    if (typeof window === 'undefined') return false;
    const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return window.matchMedia('(display-mode: standalone)').matches || standalone === true;
}

function isPushSupported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

export function NotificationsSettings() {
    const [status, setStatus] = useState<Status>('loading');
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        if (!isPushSupported()) {
            setStatus('unsupported');
            return;
        }
        if (isIosDevice() && !isStandaloneDisplay()) {
            setStatus('ios-need-pwa');
            return;
        }
        if (Notification.permission === 'denied') {
            setStatus('denied');
            return;
        }
        try {
            const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
            const sub = await reg?.pushManager.getSubscription();
            setStatus(sub && Notification.permission === 'granted' ? 'active' : 'inactive');
        } catch {
            setStatus('inactive');
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const activate = async () => {
        const vapidPublicKey = process.env.NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
            toast.error('Falta clave VAPID en el servidor');
            return;
        }
        setBusy(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                toast.error('Permiso denegado por el navegador');
                await refresh();
                return;
            }
            const registration = await navigator.serviceWorker.register(SW_PATH);
            const applicationServerKey = base64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
            const existing = await registration.pushManager.getSubscription();
            const subscription = existing ?? await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });
            const response = await fetch('/api/admin/push-subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(subscription.toJSON()),
            });
            if (!response.ok) {
                throw new Error('No se pudo guardar la suscripción');
            }
            window.localStorage.removeItem(DISMISS_KEY);
            toast.success('Notificaciones activadas');
            setStatus('active');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`No se pudo activar: ${message}`);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const deactivate = async () => {
        setBusy(true);
        try {
            const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
            const subscription = await registration?.pushManager.getSubscription();
            if (subscription) {
                await fetch('/api/admin/push-subscriptions', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
                await subscription.unsubscribe();
            }
            window.localStorage.setItem(DISMISS_KEY, '1');
            toast.success('Notificaciones desactivadas');
            setStatus('inactive');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`No se pudo desactivar: ${message}`);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="bento-card p-5 md:p-6" data-testid="notifications-settings">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-[-0.01em]">Notificaciones push</h2>
                <p className="text-sm text-[var(--text-muted)]">
                    Avisos en el navegador o móvil al entrar o cancelar una cita. Quedan activas hasta que las desactives aquí.
                </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <StatusBadge status={status} />
                <div className="flex gap-2">
                    {status === 'active' ? (
                        <button
                            type="button"
                            onClick={deactivate}
                            disabled={busy}
                            className="btn btn--ghost"
                        >
                            <Icon name="close" size={16} />
                            {busy ? 'Desactivando...' : 'Desactivar'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={activate}
                            disabled={busy || status === 'loading' || status === 'unsupported' || status === 'ios-need-pwa' || status === 'denied'}
                            className="btn btn--primary"
                        >
                            <Icon name="bell" size={16} />
                            {busy ? 'Activando...' : 'Activar notificaciones'}
                        </button>
                    )}
                </div>
            </div>

            {status === 'denied' && (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Has bloqueado las notificaciones en el navegador. Habilítalas desde la configuración del navegador y vuelve a cargar la página.
                </p>
            )}
            {status === 'ios-need-pwa' && (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                    En iPhone, añade el panel a la pantalla de inicio (Safari → Compartir → Añadir a pantalla de inicio) y abre desde allí para activar las notificaciones.
                </p>
            )}
            {status === 'unsupported' && (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Tu navegador no soporta notificaciones push.
                </p>
            )}
        </section>
    );
}

function StatusBadge({ status }: { status: Status }) {
    const map: Record<Status, { label: string; tone: string }> = {
        loading: { label: 'Comprobando...', tone: 'var(--text-muted)' },
        unsupported: { label: 'No soportado', tone: 'var(--text-muted)' },
        'ios-need-pwa': { label: 'Requiere añadir a pantalla de inicio', tone: 'var(--text-muted)' },
        denied: { label: 'Bloqueadas por el navegador', tone: '#b91c1c' },
        inactive: { label: 'Inactivas', tone: 'var(--text-muted)' },
        active: { label: 'Activas', tone: '#15803d' },
    };
    const { label, tone } = map[status];
    return (
        <span className="inline-flex items-center gap-2 text-sm" style={{ color: tone }}>
            <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: tone }}
            />
            {label}
        </span>
    );
}
