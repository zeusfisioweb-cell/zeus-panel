import { expect, type Page } from '@playwright/test';

export async function loginAsAdmin(page: Page): Promise<void> {
    if (!process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD) {
        throw new Error('Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated smoke.');
    }
    // storageState handles the session — just navigate to dashboard and verify
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
            break;
        } catch (error) {
            if (attempt === 2) throw error;
        }
    }
    await expect(page.getByRole('heading', { name: /Resumen del centro/i })).toBeVisible({ timeout: 15_000 });
}
