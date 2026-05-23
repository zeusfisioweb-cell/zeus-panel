import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const REQUIRED_ENV = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
] as const;

async function checkSupabase(): Promise<boolean> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
        const res = await fetch(`${url}/auth/v1/health`, {
            signal: controller.signal,
            headers: { apikey: anonKey },
        });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET() {
    const envOk = REQUIRED_ENV.every((key) => Boolean(process.env[key]));
    const dbOk = envOk ? await checkSupabase() : false;

    const healthy = envOk && dbOk;

    const body: Record<string, unknown> = {
        status: healthy ? 'ok' : 'degraded',
        ts: Date.now(),
    };
    // Only expose per-check detail outside production to avoid leaking
    // infra state to unauthenticated callers.
    if (process.env.NODE_ENV !== 'production') {
        body.checks = { env: envOk, db: dbOk };
    }

    return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
