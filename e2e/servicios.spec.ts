import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('servicios — services management', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        test.slow();
        await loginAsAdmin(page);
    });

    test('services page renders with header and KPI strip', async ({ page }) => {
        await page.goto('/servicios');
        await expect(page.locator('.zs-svc-header')).toBeVisible({ timeout: 15_000 });

        await expect(page.locator('.zs-svc-kpi-strip')).toBeVisible();
        await expect(page.getByRole('button', { name: /Nuevo servicio/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Nueva categ/i })).toBeVisible();

        await page.screenshot({ path: 'test-results/servicios-list.png' });
    });

    test('services catalog renders category sections or empty state', async ({ page }) => {
        await page.goto('/servicios');
        await expect(page.locator('.zs-svc-header')).toBeVisible({ timeout: 15_000 });

        // Wait for loading to finish
        await page.waitForFunction(
            () => !document.querySelector('.spinner'),
            { timeout: 10_000 },
        ).catch(() => {});

        await page.screenshot({ path: 'test-results/servicios-catalog.png' });

        // Either sections exist (.zs-svc-section) or empty state (.zs-svc-empty)
        const sections = page.locator('.zs-svc-section, .zs-svc-catalog');
        const emptyState = page.locator('.zs-svc-empty');
        const hasSections = (await sections.count()) > 0;
        const hasEmpty = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false);
        expect(hasSections || hasEmpty).toBeTruthy();
    });

    test('create new service category and verify it appears', async ({ page }) => {
        await page.goto('/servicios');
        await expect(page.locator('.zs-svc-header')).toBeVisible({ timeout: 15_000 });

        // Click "Nueva categoría"
        await page.getByRole('button', { name: /Nueva categ/i }).click();

        // CategoryFormModal dialog
        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 8_000 });
        await expect(modal.getByRole('heading', { name: /Nueva Categoría/i })).toBeVisible();

        await page.screenshot({ path: 'test-results/servicio-category-modal.png' });

        // Fill category name using the label
        const timestamp = Date.now();
        const categoryName = `CatTest${timestamp}`;
        await modal.getByLabel(/Nombre de la categor/i).fill(categoryName);

        // Submit
        await modal.getByRole('button', { name: /Crear Categoría/i }).click();

        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 8_000 });

        await page.screenshot({ path: 'test-results/servicio-category-created.png' });

        // The category name should appear as a section heading in the catalog
        await expect(page.locator('.zs-svc-section__name').filter({ hasText: categoryName })).toBeVisible({ timeout: 8_000 });
    });

    test('create new service under existing category and it appears', async ({ page }) => {
        await page.goto('/servicios');
        await expect(page.locator('.zs-svc-header')).toBeVisible({ timeout: 15_000 });

        // Check how many categories exist (from KPI)
        const categoriesKpi = page.locator('.zs-svc-kpi').filter({ hasText: /Categorías/ }).locator('.zs-svc-kpi__value');
        const countText = await categoriesKpi.textContent({ timeout: 5_000 }).catch(() => '0');
        const count = parseInt(countText || '0', 10);

        if (count === 0) {
            // Need at least one category — create one first
            await page.getByRole('button', { name: /Nueva categ/i }).click();
            const catModal = page.locator('[role="dialog"]').first();
            await expect(catModal).toBeVisible({ timeout: 8_000 });
            await catModal.getByLabel(/Nombre de la categor/i).fill('Categoría E2E Base');
            await catModal.getByRole('button', { name: /Crear Categoría/i }).click();
            await expect(catModal).not.toBeVisible({ timeout: 8_000 });
        }

        // Now click "Nuevo servicio"
        await page.getByRole('button', { name: /Nuevo servicio/i }).click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 8_000 });
        await expect(modal.getByRole('heading', { name: /Nuevo servicio/i })).toBeVisible({ timeout: 5_000 });

        await page.screenshot({ path: 'test-results/servicio-new-modal.png' });

        // Fill service name with the label "Nombre del servicio"
        const timestamp = Date.now();
        const serviceName = `ServTest${timestamp}`;
        await modal.getByLabel(/Nombre del servicio/i).fill(serviceName);

        // Fill duration (the default is 50 but let's set explicitly)
        await modal.getByLabel(/Duración/i).fill('45');

        await page.screenshot({ path: 'test-results/servicio-form-filled.png' });

        // Submit
        const submitBtn = modal.getByRole('button', { name: /crear|guardar/i }).last();
        await submitBtn.click();

        await page.waitForTimeout(1_500);
        await page.screenshot({ path: 'test-results/servicio-created.png' });

        // Service name should appear inside a category section
        await expect(page.locator('.zs-svc-catalog').getByText(serviceName)).toBeVisible({ timeout: 8_000 });
    });
});
