import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('configuracion — booking settings', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('page loads with KPI strip and settings form', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.locator('.zs-cfg-kpi-strip')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.settings-layout')).toBeVisible();
        await page.screenshot({ path: 'test-results/configuracion-loaded.png' });
    });

    test('key booking fields are pre-populated from DB', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.locator('.zs-cfg-kpi-strip')).toBeVisible({ timeout: 15_000 });

        // Cancellation hours and min notice should have numeric values
        const cancellationInput = page.getByLabel(/Cancelación \(horas\)/i);
        await expect(cancellationInput).toBeVisible({ timeout: 10_000 });
        const value = await cancellationInput.inputValue();
        expect(Number(value)).toBeGreaterThanOrEqual(0);

        const noticeInput = page.getByLabel(/Aviso mínimo \(horas\)/i);
        await expect(noticeInput).toBeVisible();
        const noticeValue = await noticeInput.inputValue();
        expect(Number(noticeValue)).toBeGreaterThanOrEqual(0);
    });

    test('KPI strip shows opening/closing hours and booking window', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.locator('.zs-cfg-kpi-strip')).toBeVisible({ timeout: 15_000 });

        const kpis = page.locator('.zs-cfg-kpi');
        const count = await kpis.count();
        expect(count).toBeGreaterThanOrEqual(3);

        // Each KPI has a label and a value
        const firstKpi = kpis.first();
        await expect(firstKpi.locator('.zs-cfg-kpi__label')).toBeVisible();
        await expect(firstKpi.locator('.zs-cfg-kpi__value')).toBeVisible();
    });

    test('save settings returns 200 and shows success toast', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.locator('.zs-cfg-kpi-strip')).toBeVisible({ timeout: 15_000 });

        // Toggle buffer_minutes by 1 to force a change
        const bufferInput = page.getByLabel(/Buffer entre citas \(min\)/i);
        await expect(bufferInput).toBeVisible({ timeout: 10_000 });
        const currentVal = Number(await bufferInput.inputValue());
        const newVal = currentVal === 10 ? 15 : 10;
        await bufferInput.fill(String(newVal));

        const responsePromise = page.waitForResponse(res =>
            res.url().includes('/api/admin/booking-settings') && res.request().method() === 'PATCH',
        );
        await page.getByRole('button', { name: /Guardar configuración/i }).click();
        const response = await responsePromise;
        expect(response.status()).toBe(200);

        // Sonner success toast
        await expect(page.getByText(/guardada correctamente/i)).toBeVisible({ timeout: 8_000 });
        await page.screenshot({ path: 'test-results/configuracion-saved.png' });
    });

    test('unauthenticated access redirects to login', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto('/configuracion');
        await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    });
});
