import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const vercelBypass = process.env.VERCEL_BYPASS_SECRET;
const hasCredentials = !!(process.env.PANEL_E2E_EMAIL && process.env.PANEL_E2E_PASSWORD);
const ADMIN_STATE = path.join(__dirname, '.playwright-mcp/admin-auth.json');

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    use: {
        baseURL,
        trace: 'on-first-retry',
        ...(vercelBypass ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': vercelBypass } } : {}),
    },
    webServer: {
        command: 'npm run dev',
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: hasCredentials
        ? [
            {
                name: 'setup',
                testMatch: /auth\.setup\.ts/,
            },
            {
                name: 'chromium',
                testIgnore: /auth\.setup\.ts/,
                use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
                dependencies: ['setup'],
            },
          ]
        : [
            {
                name: 'chromium',
                testIgnore: /auth\.setup\.ts/,
                use: { ...devices['Desktop Chrome'] },
            },
          ],
});
