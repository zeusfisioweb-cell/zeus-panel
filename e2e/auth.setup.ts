import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const ADMIN_STORAGE_STATE = path.join(process.cwd(), '.playwright-mcp/admin-auth.json');

setup('authenticate as admin', async ({ page }) => {
    const email = process.env.PANEL_E2E_EMAIL!;
    const password = process.env.PANEL_E2E_PASSWORD!;

    fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });

    await page.goto('/login');
    await page.getByLabel('Correo de acceso').fill(email);
    await page.getByLabel(/Contrase[nñ]a/i).fill(password);
    await page.getByRole('button', { name: 'Entrar al panel' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Resumen del centro/i })).toBeVisible({ timeout: 15_000 });

    await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
