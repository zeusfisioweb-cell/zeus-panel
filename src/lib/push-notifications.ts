import webpush from 'web-push';
import { getAdminSupabase } from '@/app/api/admin/_lib';

const PANEL_ALERT_PATH = '/citas';

interface PushSubscriptionRow {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

interface PanelAppointmentPushPayload {
    title: string;
    body: string;
    tag: string;
    url: string;
    icon: string;
    badge: string;
    timestampMs: number;
    renotify: boolean;
    requireInteraction: boolean;
    silent: boolean;
    actions: Array<{
        action: string;
        title: string;
    }>;
    data: {
        kind: 'created' | 'cancelled';
        url: string;
        appointmentStartTime: string;
    };
}

interface SendPanelAppointmentPushParams {
    kind: 'created' | 'cancelled';
    patientName: string;
    serviceName: string;
    startTime: string;
}

let vapidConfigured = false;

function formatAppointmentDate(startTime: string): string {
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Madrid',
    }).format(new Date(startTime));
}

function normalizeText(input: string | null | undefined, fallback: string): string {
    if (!input) return fallback;
    const next = input.trim();
    return next.length > 0 ? next : fallback;
}

function buildNotificationTag(kind: SendPanelAppointmentPushParams['kind'], startTime: string): string {
    const compactStartTime = startTime.replace(/[^0-9]/g, '').slice(0, 12) || 'no-time';
    return `appointment-${kind}-${compactStartTime}`;
}

function getTimestampMs(startTime: string): number {
    const parsed = new Date(startTime);
    if (Number.isNaN(parsed.getTime())) return Date.now();
    return parsed.getTime();
}

export function buildPanelAppointmentPushPayload(
    params: SendPanelAppointmentPushParams
): PanelAppointmentPushPayload {
    const patient = normalizeText(params.patientName, 'Paciente');
    const service = normalizeText(params.serviceName, 'Servicio');
    const dateText = formatAppointmentDate(params.startTime);
    const tag = buildNotificationTag(params.kind, params.startTime);
    const base: Omit<PanelAppointmentPushPayload, 'title'> = {
        body: `${patient} · ${service} · ${dateText}`,
        tag,
        url: PANEL_ALERT_PATH,
        icon: '/zeus-favicon.png',
        badge: '/zeus-favicon.png',
        timestampMs: getTimestampMs(params.startTime),
        renotify: true,
        requireInteraction: params.kind === 'cancelled',
        silent: false,
        actions: [{ action: 'open_schedule', title: 'Ver agenda' }],
        data: {
            kind: params.kind,
            url: PANEL_ALERT_PATH,
            appointmentStartTime: params.startTime,
        },
    };

    if (params.kind === 'created') {
        return {
            title: 'Nueva cita',
            ...base,
        };
    }

    return {
        title: 'Cita cancelada',
        ...base,
    };
}

function ensureVapidConfig(): boolean {
    if (vapidConfigured) return true;

    const publicKey = process.env.NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY;
    const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
    const subject = process.env.PUSH_VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
        console.warn('[push] Missing VAPID config (keys or subject). Push disabled.');
        return false;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
}

async function getPanelUserIds(): Promise<string[]> {
    const admin = getAdminSupabase();
    const { data, error } = await admin
        .from('profiles')
        .select('id')
        .in('role', ['owner', 'professional']);

    if (error) {
        console.error('[push] Failed to load panel users:', error.message);
        return [];
    }

    return (data ?? [])
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

async function getActiveSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]> {
    if (userIds.length === 0) return [];

    const admin = getAdminSupabase();
    const { data, error } = await admin
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth')
        .in('user_id', userIds)
        .is('disabled_at', null);

    if (error) {
        console.error('[push] Failed to load push subscriptions:', error.message);
        return [];
    }

    return (data ?? []) as PushSubscriptionRow[];
}

async function disableSubscription(subscriptionId: string): Promise<void> {
    const admin = getAdminSupabase();
    const { error } = await admin
        .from('push_subscriptions')
        .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);

    if (error) {
        console.error('[push] Failed to disable subscription:', error.message);
    }
}

async function markSubscriptionDelivered(subscriptionId: string): Promise<void> {
    const admin = getAdminSupabase();
    const nowIso = new Date().toISOString();
    const { error } = await admin
        .from('push_subscriptions')
        .update({ last_success_at: nowIso, updated_at: nowIso })
        .eq('id', subscriptionId);

    if (error) {
        console.error('[push] Failed to update last_success_at:', error.message);
    }
}

export async function sendPanelAppointmentPush(params: SendPanelAppointmentPushParams): Promise<void> {
    // Always called fire-and-forget (void). Must never reject, or it becomes an
    // unhandled promise rejection (e.g. getAdminSupabase() throws if the service
    // role key is missing).
    try {
        if (!ensureVapidConfig()) return;

        const userIds = await getPanelUserIds();
        const subscriptions = await getActiveSubscriptions(userIds);
        if (subscriptions.length === 0) return;

        const payload = JSON.stringify(buildPanelAppointmentPushPayload(params));

        await Promise.allSettled(
            subscriptions.map(async (subscription) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.p256dh,
                                auth: subscription.auth,
                            },
                        },
                        payload
                    );
                    await markSubscriptionDelivered(subscription.id);
                } catch (error) {
                    const statusCode = (error as { statusCode?: number })?.statusCode;
                    if (statusCode === 404 || statusCode === 410) {
                        await disableSubscription(subscription.id);
                    } else {
                        console.error('[push] sendNotification failed:', error);
                    }
                }
            })
        );
    } catch (error) {
        console.error('[push] sendPanelAppointmentPush failed:', error);
    }
}
