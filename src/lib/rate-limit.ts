import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number };

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

    if (!limiter) {
        if (process.env.NODE_ENV === 'production') {
            return {
                success: false,
                limit: requests,
                remaining: 0,
                reset: Date.now() + windowSeconds * 1000,
            };
        }

        return { success: true, limit: requests, remaining: requests, reset: 0 };
    }

    const result = await limiter.limit(`${limiterKey}:${identifier}`);
    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    };
}
