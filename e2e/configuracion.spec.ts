import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('configuracion — booking settings', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        test.slow();
        await loginAsAdmin(page);
    });

    test('page loads with simplified settings form', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
        await page.screenshot({ path: 'test-results/configuracion-loaded.png' });
    });

    test('key booking fields are pre-populated from DB', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 });

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

    test('only operational fields are shown', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 });

        await expect(page.getByLabel(/Nombre de la clínica/i)).toBeVisible();
        await expect(page.getByLabel(/Apertura/i)).toBeVisible();
        await expect(page.getByLabel(/Cierre/i)).toBeVisible();
        await expect(page.getByLabel(/Intervalo de huecos \(min\)/i)).toBeVisible();
        await expect(page.getByLabel(/Email/i)).toHaveCount(0);
        await expect(page.getByLabel(/Dirección/i)).toHaveCount(0);
        await expect(page.getByLabel(/Texto RGPD \/ LOPDGDD/i)).toHaveCount(0);
    });

    test('save settings returns 200 and shows success toast', async ({ page }) => {
        await page.goto('/configuracion');
        await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 });

        // Change cancellation hours by 1 to force a persisted update
        const cancellationInput = page.getByLabel(/Cancelación \(horas\)/i);
        await expect(cancellationInput).toBeVisible({ timeout: 10_000 });
        const currentVal = Number(await cancellationInput.inputValue());
        const newVal = currentVal === 24 ? 25 : 24;
        await cancellationInput.fill(String(newVal));

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
