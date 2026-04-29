import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from './rate-limit';

const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

describe('checkRateLimit', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
        process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    });

    it('fails closed in production when Upstash is not configured', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
        vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

        const result = await checkRateLimit('127.0.0.1', 'test', 5, 60);

        expect(result.success).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(5);
        expect(result.reset).toBeGreaterThan(Date.now());
    });

    it('allows requests without Upstash outside production', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
        vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

        const result = await checkRateLimit('127.0.0.1', 'test', 5, 60);

        expect(result.success).toBe(true);
        expect(result.remaining).toBe(5);
    });
});
