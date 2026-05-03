import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, getRetryAfterSeconds, RATE_LIMIT_MESSAGE } from './rate-limit';

describe('checkRateLimit (in-memory fallback — no Upstash)', () => {
    beforeEach(() => {
        vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
        vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('allows requests under the limit', async () => {
        const result = await checkRateLimit('ip-allow', 'test-allow', 3, 60);

        expect(result.success).toBe(true);
        expect(result.limit).toBe(3);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
        expect(result.reset).toBeGreaterThan(0);
    });

    it('blocks requests once the limit is reached in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        const key = 'ip-prod-block';
        // Exhaust the limit (requests = 2)
        await checkRateLimit(key, 'test-block', 2, 60);
        await checkRateLimit(key, 'test-block', 2, 60);

        // Third call must be denied
        const result = await checkRateLimit(key, 'test-block', 2, 60);

        expect(result.success).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(2);
    });

    it('resets the window after the time expires', async () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const key = 'ip-reset';
        // Exhaust a 1-second window
        await checkRateLimit(key, 'test-reset', 1, 1);
        const blocked = await checkRateLimit(key, 'test-reset', 1, 1);
        expect(blocked.success).toBe(false);

        // Advance past the window
        vi.setSystemTime(now + 1500);

        const allowed = await checkRateLimit(key, 'test-reset', 1, 1);
        expect(allowed.success).toBe(true);

        vi.useRealTimers();
    });
});

describe('getRetryAfterSeconds', () => {
    it('returns seconds until reset, floored to at least 1', () => {
        const reset = Date.now() + 5000;
        const seconds = getRetryAfterSeconds(reset);
        expect(seconds).toBeGreaterThanOrEqual(4);
        expect(seconds).toBeLessThanOrEqual(5);
    });

    it('returns 1 when reset is already in the past', () => {
        const reset = Date.now() - 1000;
        expect(getRetryAfterSeconds(reset)).toBe(1);
    });
});

describe('RATE_LIMIT_MESSAGE', () => {
    it('is a non-empty string', () => {
        expect(typeof RATE_LIMIT_MESSAGE).toBe('string');
        expect(RATE_LIMIT_MESSAGE.length).toBeGreaterThan(0);
    });
});
