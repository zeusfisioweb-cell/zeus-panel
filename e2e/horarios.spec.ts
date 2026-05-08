import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('horarios — professional schedules', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('page loads with header, KPI strip, and professional selector', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.zs-hor-header')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.zs-hor-kpi-strip')).toBeVisible();
        await expect(page.locator('.zs-hor-pro-picker')).toBeVisible();
        await page.screenshot({ path: 'test-results/horarios-loaded.png' });
    });

    test('weekly schedule grid shows 7 day rows', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.schedule-day-list')).toBeVisible({ timeout: 15_000 });

        const dayRows = page.locator('.schedule-day');
        const count = await dayRows.count();
        expect(count).toBe(7);
        await page.screenshot({ path: 'test-results/horarios-grid.png' });
    });

    test('each day row shows day name', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.schedule-day-list')).toBeVisible({ timeout: 15_000 });

        const firstDay = page.locator('.schedule-day').first();
        await expect(firstDay.locator('.schedule-day__name')).toBeVisible();
        const dayName = await firstDay.locator('.schedule-day__name').textContent();
        expect(dayName?.trim().length).toBeGreaterThan(0);
    });

    test('KPI strip shows weekly slot count and active days', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.zs-hor-kpi-strip')).toBeVisible({ timeout: 15_000 });

        const kpis = page.locator('.zs-hor-kpi');
        const count = await kpis.count();
        expect(count).toBeGreaterThanOrEqual(2);

        // Franjas semanales and Días activos
        await expect(page.locator('.zs-hor-kpi__label').filter({ hasText: /Franjas/i })).toBeVisible();
        await expect(page.locator('.zs-hor-kpi__label').filter({ hasText: /Días activos/i })).toBeVisible();
    });

    test('professional selector changes view on selection', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.zs-hor-pro-picker__select')).toBeVisible({ timeout: 15_000 });

        const select = page.locator('.zs-hor-pro-picker__select');
        const options = await select.locator('option').count();

        if (options <= 1) {
            test.skip(true, 'Only one or no professional — selector change not testable');
        }

        // Get the second option value
        const secondOption = await select.locator('option').nth(1).getAttribute('value');
        if (secondOption) {
            await select.selectOption(secondOption);
            await page.waitForTimeout(500);
            // Grid should still render after switching professional
            await expect(page.locator('.schedule-day-list')).toBeVisible({ timeout: 8_000 });
        }
        await page.screenshot({ path: 'test-results/horarios-pro-switch.png' });
    });

    test('exceptions section shows or displays empty state', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.schedule-card--exceptions')).toBeVisible({ timeout: 15_000 });

        const exceptionItems = page.locator('.schedule-exception-item');
        const emptyState = page.locator('.schedule-empty');
        const hasItems = (await exceptionItems.count()) > 0;
        const hasEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasItems || hasEmpty).toBeTruthy();
    });

    test('add manual slot form is visible with day/time inputs', async ({ page }) => {
        await page.goto('/horarios');
        await expect(page.locator('.schedule-slot-builder')).toBeVisible({ timeout: 15_000 });

        await expect(page.getByLabel('Día')).toBeVisible();
        await expect(page.getByLabel('Desde')).toBeVisible();
        await expect(page.getByLabel('Hasta')).toBeVisible();
        await expect(page.getByRole('button', { name: /Añadir franja/i })).toBeVisible();
    });
});
