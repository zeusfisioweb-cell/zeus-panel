import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('configuracion — booking settings', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test('guardar configuración responde 200', async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto('/configuracion');
        await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();

        const saveResponsePromise = page.waitForResponse((response) => (
            response.url().includes('/api/admin/booking-settings')
            && response.request().method() === 'PATCH'
        ));

        await page.getByRole('button', { name: 'Guardar configuración' }).click();

        const saveResponse = await saveResponsePromise;
        expect(saveResponse.status()).toBe(200);
        await expect(page.getByText('Configuración guardada correctamente')).toBeVisible();
    });
});
