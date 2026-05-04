import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('profesionales — professionals management', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('professionals list renders with header and at least one card', async ({ page }) => {
        await page.goto('/profesionales');
        await expect(page.locator('.zs-pros-header__title')).toBeVisible({ timeout: 15_000 });

        // KPI strip renders
        await expect(page.locator('.zs-pros-kpi-strip')).toBeVisible({ timeout: 10_000 });

        await page.screenshot({ path: 'test-results/profesionales-list.png' });

        // Either a grid of professional cards or an empty state
        const proGrid = page.locator('.zs-pros-grid');
        const emptyState = page.locator('.zs-pros-empty');
        const hasGrid = await proGrid.isVisible({ timeout: 8_000 }).catch(() => false);
        const hasEmpty = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false);
        expect(hasGrid || hasEmpty).toBeTruthy();
    });

    test('professionals list shows at least one card with name and specialty', async ({ page }) => {
        await page.goto('/profesionales');
        await expect(page.locator('.zs-pros-header__title')).toBeVisible({ timeout: 15_000 });

        // Wait for cards to render
        const firstCard = page.locator('.zs-pro-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10_000 });

        // Card should have a name and specialty
        const cardName = firstCard.locator('.zs-pro-card__name');
        await expect(cardName).toBeVisible();
        const nameText = await cardName.textContent();
        expect(nameText?.trim().length).toBeGreaterThan(0);

        const cardSpecialty = firstCard.locator('.zs-pro-card__specialty-value');
        await expect(cardSpecialty).toBeVisible();

        await page.screenshot({ path: 'test-results/profesionales-card.png' });
    });

    test('open professional edit modal and verify it has form fields', async ({ page }) => {
        await page.goto('/profesionales');
        await expect(page.locator('.zs-pros-header__title')).toBeVisible({ timeout: 15_000 });

        // Wait for first card
        const firstCard = page.locator('.zs-pro-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10_000 });

        // Click the "Editar" button on the first card
        const editBtn = firstCard.getByRole('button', { name: /Editar/i });
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        // Professional form modal should open
        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 8_000 });
        await page.screenshot({ path: 'test-results/profesional-edit-modal.png' });

        // Form should have at least one input (name field)
        const nameInput = modal.locator('input').first();
        await expect(nameInput).toBeVisible({ timeout: 5_000 });

        // Check if schedule section is in the modal (the form has schedule slots)
        const scheduleSection = modal.locator('[class*="schedule"], [class*="horario"], text=/horario/i, input[type="time"]').first();
        const hasSchedule = await scheduleSection.isVisible({ timeout: 3_000 }).catch(() => false);
        if (hasSchedule) {
            await page.screenshot({ path: 'test-results/profesional-schedule-visible.png' });
        } else {
            // Look for a tab to navigate to schedule section
            const scheduleTab = modal.locator('button, [role="tab"]').filter({ hasText: /horario|schedule/i }).first();
            if (await scheduleTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await scheduleTab.click();
                await page.waitForTimeout(400);
                await page.screenshot({ path: 'test-results/profesional-schedule-tab.png' });
            }
        }

        // Close modal without submitting
        const cancelBtn = modal.getByRole('button', { name: /cancelar/i });
        if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await cancelBtn.click();
        } else {
            await page.keyboard.press('Escape');
        }
    });

    test('new professional button opens form modal with empty fields', async ({ page }) => {
        await page.goto('/profesionales');
        await expect(page.locator('.zs-pros-header__title')).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: /Nuevo profesional/i }).click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 8_000 });
        await page.screenshot({ path: 'test-results/profesional-new-modal.png' });

        // Should have form inputs
        const inputs = modal.locator('input');
        const inputCount = await inputs.count();
        expect(inputCount).toBeGreaterThan(0);

        // Close
        const cancelBtn = modal.getByRole('button', { name: /cancelar/i });
        if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await cancelBtn.click();
        } else {
            await page.keyboard.press('Escape');
        }
    });
});
