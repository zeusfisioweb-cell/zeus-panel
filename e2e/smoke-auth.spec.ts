import { expect, test } from '@playwright/test';

test('redirects unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
});

test('renders login form controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Iniciar sesi[oó]n/i })).toBeVisible();
    await expect(page.getByLabel('Correo de acceso')).toBeVisible();
    await expect(page.getByLabel(/Contrase[nñ]a/i)).toBeVisible();
    await expect(page.getByRole('button')).toContainText(/Entrar al panel|Preparando|Verificando/i);
});

test('logs in with configured e2e credentials when provided', async ({ page }) => {
    const email = process.env.PANEL_E2E_EMAIL;
    const password = process.env.PANEL_E2E_PASSWORD;

    test.skip(!email || !password, 'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated smoke.');

    await page.goto('/login');
    await page.getByLabel('Correo de acceso').fill(email as string);
    await page.getByLabel(/Contrase[nñ]a/i).fill(password as string);
    await page.getByRole('button', { name: 'Entrar al panel' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Resumen del centro/i })).toBeVisible();
});
