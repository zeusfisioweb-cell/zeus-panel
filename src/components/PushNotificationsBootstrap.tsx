'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const SW_PATH = '/push-sw.js';

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
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
}

function isStandaloneDisplay(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PushNotificationsBootstrap() {
    const askedRef = useRef(false);
    const onboardingToastShownRef = useRef(false);

    useEffect(() => {
        async function bootstrap() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                return;
            }

            const vapidPublicKey = process.env.NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) return;

            if (isIosDevice() && !isStandaloneDisplay()) {
                const seen = window.localStorage.getItem('zeus_push_ios_hint_seen');
                if (!seen && !onboardingToastShownRef.current) {
                    onboardingToastShownRef.current = true;
                    toast.message('Para iPhone', {
                        description: 'Añade el panel a pantalla de inicio para activar notificaciones push.',
                        duration: 9000,
                    });
                    window.localStorage.setItem('zeus_push_ios_hint_seen', '1');
                }
                return;
            }

            const registration = await navigator.serviceWorker.register(SW_PATH);
            const currentSubscription = await registration.pushManager.getSubscription();

            if (currentSubscription) {
                await fetch('/api/admin/push-subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(currentSubscription.toJSON()),
                });
                return;
            }

            if (Notification.permission === 'granted') {
                const applicationServerKey = base64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });
                await fetch('/api/admin/push-subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(subscription.toJSON()),
                });
                return;
            }

            if (Notification.permission === 'default' && !askedRef.current) {
                askedRef.current = true;
                toast.message('Activa notificaciones', {
                    description: 'Recibe avisos en tu móvil cuando entra o se cancela una cita.',
                    action: {
                        label: 'Activar',
                        onClick: async () => {
                            const permission = await Notification.requestPermission();
                            if (permission !== 'granted') return;

                            const reg = await navigator.serviceWorker.register(SW_PATH);
                            const applicationServerKey = base64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
                            const subscription = await reg.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey,
                            });

                            await fetch('/api/admin/push-subscriptions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'same-origin',
                                body: JSON.stringify(subscription.toJSON()),
                            });

                            toast.success('Notificaciones activadas');
                        },
                    },
                    duration: 10000,
                });
            }
        }

        void bootstrap();
    }, []);

    return null;
}
