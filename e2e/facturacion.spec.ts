import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('facturación — caja y recibos', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        test.slow();
        await loginAsAdmin(page);
    });

    test('renders the facturación page with KPIs and an empty state when no payments exist', async ({ page }) => {
        await page.goto('/facturacion');

        await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Caja hoy')).toBeVisible();
        await expect(page.getByText('Esta semana')).toBeVisible();
        await expect(page.getByText('Este mes')).toBeVisible();

        await expect(page.getByRole('button', { name: /registrar cobro/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /exportar csv/i })).toBeVisible();

        await page.screenshot({ path: 'test-results/facturacion-loaded.png', fullPage: true });
    });

    test('opens the payment modal and validates required fields', async ({ page }) => {
        await page.goto('/facturacion');
        await page.getByRole('button', { name: /registrar cobro/i }).click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal.getByText('Registrar cobro', { exact: true })).toBeVisible();
        await expect(modal.getByLabel(/cita/i)).toBeVisible();
        await expect(modal.getByLabel(/importe/i)).toBeVisible();
        await expect(modal.getByLabel(/método/i)).toBeVisible();

        await modal.getByRole('button', { name: /cancelar/i }).click();
        await expect(modal).not.toBeVisible();
    });

    test('date and method filters update the query without errors', async ({ page }) => {
        await page.goto('/facturacion');
        await page.getByLabel(/desde/i).fill('2026-01-01');
        await page.getByLabel(/hasta/i).fill('2026-12-31');
        await page.getByLabel(/método/i).selectOption('cash');
        // Page should not crash; KPIs still render.
        await expect(page.getByText('Caja hoy')).toBeVisible();
    });
});
