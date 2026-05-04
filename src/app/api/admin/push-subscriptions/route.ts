import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ApiRouteError,
    assertSameOriginMutation,
    handleApiError,
    requirePanelAccess,
    writeAuditLog,
} from '../_lib';

const subscriptionSchema = z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({
        p256dh: z.string().min(1).max(1000),
        auth: z.string().min(1).max(1000),
    }),
});

const deleteSchema = z.object({
    endpoint: z.string().url().max(2000),
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess();
        const parsed = subscriptionSchema.parse(await request.json());
        const nowIso = new Date().toISOString();
        const userAgent = request.headers.get('user-agent');

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    endpoint: parsed.endpoint,
                    p256dh: parsed.keys.p256dh,
                    auth: parsed.keys.auth,
                    user_agent: userAgent,
                    disabled_at: null,
                    updated_at: nowIso,
                },
                { onConflict: 'endpoint' }
            );

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'push_subscriptions',
            recordId: parsed.endpoint,
            details: { scope: 'panel_notifications_push_subscribe' },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess();
        const parsed = deleteSchema.parse(await request.json());

        const { error } = await supabase
            .from('push_subscriptions')
            .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('endpoint', parsed.endpoint);

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'push_subscriptions',
            recordId: parsed.endpoint,
            details: { scope: 'panel_notifications_push_unsubscribe' },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function GET() {
    try {
        const { supabase, userId } = await requirePanelAccess();
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('endpoint, disabled_at')
            .eq('user_id', userId)
            .is('disabled_at', null);

        if (error) throw error;

        return NextResponse.json({ enabled: (data ?? []).length > 0 });
    } catch (error) {
        if (error instanceof ApiRouteError && error.status === 401) {
            return NextResponse.json({ enabled: false }, { status: 200 });
        }
        return handleApiError(error);
    }
}

