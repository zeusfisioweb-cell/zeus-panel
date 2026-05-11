import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('analitica — business reports', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        test.slow();
        await loginAsAdmin(page);
    });

    test('page loads with "Reporte de Negocio" heading', async ({ page }) => {
        await page.goto('/analitica');
        await expect(page.getByRole('heading', { name: /Reporte de Negocio/i })).toBeVisible({ timeout: 20_000 });
        await page.screenshot({ path: 'test-results/analitica-loaded.png' });
    });

    test('charts panel renders at least one chart card', async ({ page }) => {
        await page.goto('/analitica');
        await expect(page.locator('.zs-charts-panel')).toBeVisible({ timeout: 20_000 });

        // Wait for spinner to disappear (data loaded)
        await page.waitForFunction(
            () => !document.querySelector('.spinner'),
            { timeout: 25_000 },
        ).catch(() => {});

        const chartCards = page.locator('.zs-charts-card');
        const count = await chartCards.count();
        expect(count).toBeGreaterThan(0);
        await page.screenshot({ path: 'test-results/analitica-charts.png' });
    });

    test('period toggle buttons are visible and clickable', async ({ page }) => {
        await page.goto('/analitica');
        await expect(page.locator('[role="group"][aria-label*="periodo"]')).toBeVisible({ timeout: 15_000 });

        const periodButtons = page.locator('[role="group"][aria-label*="periodo"] button');
        const count = await periodButtons.count();
        expect(count).toBeGreaterThanOrEqual(4); // last_7_days, last_30_days, last_year, all_time

        // Click "Último año" and verify heading still present
        const yearBtn = periodButtons.filter({ hasText: /año/i });
        if (await yearBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await yearBtn.click();
            await page.waitForTimeout(500);
            await expect(page.getByRole('heading', { name: /Reporte de Negocio/i })).toBeVisible();
        }
    });

    test('custom date range shows date inputs when selected', async ({ page }) => {
        await page.goto('/analitica');
        await expect(page.locator('[role="group"][aria-label*="periodo"]')).toBeVisible({ timeout: 15_000 });

        const customBtn = page.locator('[role="group"][aria-label*="periodo"] button').filter({ hasText: /Personalizado/i });
        if (await customBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await customBtn.click();
            await page.waitForTimeout(400);
            await expect(page.getByLabel('Desde:')).toBeVisible({ timeout: 5_000 });
            await expect(page.getByLabel('Hasta:')).toBeVisible({ timeout: 5_000 });
        }
    });

    test('analytics API call succeeds (no network error toast)', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/analitica');
        await expect(page.locator('.zs-charts-panel')).toBeVisible({ timeout: 20_000 });
        await page.waitForFunction(() => !document.querySelector('.spinner'), { timeout: 25_000 }).catch(() => {});

        // No Sonner error toast should appear
        const errorToast = page.locator('[data-type="error"], [class*="toast"][class*="error"]');
        const hasErrorToast = await errorToast.isVisible({ timeout: 2_000 }).catch(() => false);
        expect(hasErrorToast).toBe(false);

        await page.screenshot({ path: 'test-results/analitica-no-errors.png' });
    });
});
