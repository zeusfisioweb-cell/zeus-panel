import { expect, type Page } from '@playwright/test';

export async function loginAsAdmin(page: Page): Promise<void> {
    if (!process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD) {
        throw new Error('Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated smoke.');
    }
    // storageState handles the session — just navigate to dashboard and verify
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Resumen del centro/i })).toBeVisible({ timeout: 15_000 });
}
