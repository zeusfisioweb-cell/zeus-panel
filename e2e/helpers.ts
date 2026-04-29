import { expect, type Page } from '@playwright/test';

export async function loginAsAdmin(page: Page): Promise<void> {
    const email = process.env.PANEL_E2E_EMAIL;
    const password = process.env.PANEL_E2E_PASSWORD;

    if (!email || !password) {
        throw new Error('Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated smoke.');
    }

    await page.goto('/login');
    await page.getByLabel('Correo de acceso').fill(email);
    await page.getByLabel(/Contrase[nñ]a/i).fill(password);
    await page.getByRole('button', { name: 'Entrar al panel' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Resumen del centro/i })).toBeVisible();
}
