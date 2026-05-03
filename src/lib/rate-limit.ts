import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number };

export const RATE_LIMIT_MESSAGE = 'Hemos detectado varios intentos seguidos. Espera un momento e inténtalo de nuevo.';

const inMemoryBuckets = new Map<string, number[]>();

function buildLimiter(requests: number, windowSeconds: number): Ratelimit | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    return new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    });
}

// 5 requests per hour per IP — for sensitive write endpoints
export async function checkRateLimit(
    identifier: string,
    limiterKey: string,
    requests = 5,
    windowSeconds = 3600
): Promise<RateLimitResult> {
    const limiter = buildLimiter(requests, windowSeconds);
    const scopedKey = `${limiterKey}:${identifier}`;

    if (!limiter) {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;
        const active = (inMemoryBuckets.get(scopedKey) ?? []).filter((ts) => ts > now - windowMs);
        const success = active.length < requests;
        const updated = success ? [...active, now] : active;
        inMemoryBuckets.set(scopedKey, updated);

        const remaining = Math.max(0, requests - updated.length);
        const reset = updated.length > 0 ? updated[0] + windowMs : now + windowMs;

        return { success, limit: requests, remaining, reset };
    }

    const result = await limiter.limit(scopedKey);
    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    };
}

export function getRetryAfterSeconds(reset: number): number {
    return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}
