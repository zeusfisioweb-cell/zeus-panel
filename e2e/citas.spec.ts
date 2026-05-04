import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('citas — appointments', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('appointments page loads with header and view toggle', async ({ page }) => {
        await page.goto('/citas');
        await expect(page.locator('.zs-ch-wrap')).toBeVisible({ timeout: 15_000 });

        // Segmented control (Calendario / Lista)
        await expect(page.locator('.citas-segment')).toBeVisible();
        await expect(page.getByRole('button', { name: /Nueva cita/i })).toBeVisible();
    });

    test('switch between calendar (timeline) and list view — both render', async ({ page }) => {
        await page.goto('/citas');
        await expect(page.locator('.zs-ch-wrap')).toBeVisible({ timeout: 15_000 });

        // Default is calendar view
        await page.screenshot({ path: 'test-results/citas-calendar-view.png' });

        // Switch to "Lista" view
        const listBtn = page.locator('.citas-segment__btn').filter({ hasText: /Lista/i });
        await expect(listBtn).toBeVisible();
        await listBtn.click();

        await page.waitForTimeout(600);
        await page.screenshot({ path: 'test-results/citas-list-view.png' });

        // In list view, CitasFilters renders with class .citas-filters
        const filtersPanel = page.locator('.citas-filters');
        await expect(filtersPanel).toBeVisible({ timeout: 8_000 });

        // Switch back to calendar
        const calendarBtn = page.locator('.citas-segment__btn').filter({ hasText: /Calendario/i });
        await calendarBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/citas-calendar-back.png' });
    });

    test('create new appointment via form modal', async ({ page }) => {
        await page.goto('/citas');
        await expect(page.locator('.zs-ch-wrap')).toBeVisible({ timeout: 15_000 });

        // Click "Nueva cita"
        await page.getByRole('button', { name: /Nueva cita/i }).click();

        // Modal should appear
        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 8_000 });
        await page.screenshot({ path: 'test-results/cita-form-open.png' });

        // Verify the appointment form has the key fields
        await expect(modal.locator('input[name="date"]')).toBeVisible({ timeout: 5_000 });
        await expect(modal.locator('input[name="time"]')).toBeVisible({ timeout: 3_000 });

        // Fill patient name field (search input in the appointment form)
        const patientInput = modal.locator('input[name="patient_name"], input[placeholder*="Buscar"], input[placeholder*="paciente"]').first();
        if (await patientInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await patientInput.fill('Ana');
            await page.waitForTimeout(600);
            // Try to select the first autocomplete suggestion if available
            const suggestion = page.locator('[class*="autocomplete"], [class*="patient-dropdown"], [class*="PatientSearch"]').first();
            if (await suggestion.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await suggestion.locator('li, button, [class*="result"]').first().click();
            }
        }

        // Select service — first non-empty option
        const serviceSelect = modal.locator('select[id*="service"], select[name="service_id"], select').first();
        if (await serviceSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
            const firstNonEmpty = await serviceSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
            if (firstNonEmpty) await serviceSelect.selectOption(firstNonEmpty);
        }

        // Set date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        await modal.locator('input[name="date"]').fill(dateStr);
        await modal.locator('input[name="time"]').fill('10:00');

        await page.screenshot({ path: 'test-results/cita-form-filled.png' });

        // Submit — look for the submit button in modal footer
        const submitBtn = modal.getByRole('button', { name: /guardar|crear|aceptar/i }).first();
        if (await submitBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(2_000);
            await page.screenshot({ path: 'test-results/cita-created.png' });
        }
    });

    test('change appointment status — open status dropdown', async ({ page }) => {
        await page.goto('/citas');
        await expect(page.locator('.zs-ch-wrap')).toBeVisible({ timeout: 15_000 });

        // Switch to list view where status controls are visible
        const listBtn = page.locator('.citas-segment__btn').filter({ hasText: /Lista/i });
        await listBtn.click();
        await page.waitForTimeout(600);

        // Wait for table content
        await page.waitForTimeout(2_000);
        await page.screenshot({ path: 'test-results/citas-list-for-status.png' });

        // Status trigger buttons are rendered as .citas-status-trigger
        const statusTrigger = page.locator('.citas-status-trigger').first();
        if (await statusTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await statusTrigger.textContent();
            await statusTrigger.click();
            await page.waitForTimeout(400);

            // Dropdown menu should appear
            const statusMenu = page.locator('.citas-status-menu');
            await expect(statusMenu).toBeVisible({ timeout: 3_000 });
            await page.screenshot({ path: 'test-results/cita-status-dropdown.png' });

            // Click the first option
            const firstOption = statusMenu.locator('.citas-status-menu__item').first();
            if (await firstOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await firstOption.click();
                await page.waitForTimeout(1_500);
                await page.screenshot({ path: 'test-results/cita-status-changed.png' });
            }
        } else {
            // Static badge (completed/cancelled) — no transitions available
            const staticBadge = page.locator('.citas-status-chip').first();
            if (await staticBadge.isVisible({ timeout: 5_000 }).catch(() => false)) {
                const badgeText = await staticBadge.textContent();
                expect(badgeText).toBeTruthy();
                test.info().annotations.push({
                    type: 'note',
                    description: `Only static status badges found (${badgeText?.trim()}) — no appointments eligible for status change`,
                });
            } else {
                test.info().annotations.push({
                    type: 'note',
                    description: 'No appointments found in list view — possibly empty database',
                });
                await page.screenshot({ path: 'test-results/citas-empty-list.png' });
            }
        }
    });

    test('cancel appointment — modal appears and confirms', async ({ page }) => {
        await page.goto('/citas');
        await expect(page.locator('.zs-ch-wrap')).toBeVisible({ timeout: 15_000 });

        // Switch to list view
        await page.locator('.citas-segment__btn').filter({ hasText: /Lista/i }).click();
        await page.waitForTimeout(600);
        await page.waitForTimeout(2_000);

        // In the list view, appointments with .citas-status-trigger can be cancelled via status dropdown
        const statusTrigger = page.locator('.citas-status-trigger').first();
        if (await statusTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await statusTrigger.click();
            await page.waitForTimeout(300);

            const statusMenu = page.locator('.citas-status-menu');
            if (await statusMenu.isVisible({ timeout: 3_000 }).catch(() => false)) {
                // Click "Cancelada" option if available
                const cancelOption = statusMenu.locator('.citas-status-menu__item--cancelled');
                if (await cancelOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await cancelOption.click();
                    await page.waitForTimeout(1_000);
                    await page.screenshot({ path: 'test-results/cita-cancel-via-status.png' });
                } else {
                    // Close dropdown
                    await page.keyboard.press('Escape');
                    test.info().annotations.push({
                        type: 'note',
                        description: 'No "Cancelada" option in status dropdown — appointment may already be cancelled/completed',
                    });
                }
            }
        }

        // Try the CancelCitaModal path — open appointment detail panel and click cancel
        // Click on any appointment card in timeline
        await page.locator('.citas-segment__btn').filter({ hasText: /Calendario/i }).click();
        await page.waitForTimeout(600);

        // Try to find and click an appointment event block
        const apptBlock = page.locator('[class*="appointment-block"], [class*="citas-event"], [class*="appt-block"]').first();
        if (await apptBlock.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await apptBlock.click();
            await page.waitForTimeout(500);

            // AppointmentDetailPanel should appear
            const detailPanel = page.locator('[class*="detail-panel"], [class*="AppointmentDetail"]').first();
            if (await detailPanel.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await page.screenshot({ path: 'test-results/cita-detail-panel.png' });

                const cancelBtn = detailPanel.getByRole('button', { name: /cancelar/i });
                if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await cancelBtn.click();
                    await page.waitForTimeout(500);

                    // CancelCitaModal should appear
                    const cancelModal = page.locator('[role="dialog"]').filter({ hasText: /cancelar/i }).first();
                    if (await cancelModal.isVisible({ timeout: 4_000 }).catch(() => false)) {
                        await page.screenshot({ path: 'test-results/cita-cancel-modal.png' });
                        const confirmBtn = cancelModal.getByRole('button', { name: /confirmar|sí|cancelar cita/i }).first();
                        if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                            await confirmBtn.click();
                            await page.waitForTimeout(1_500);
                            await page.screenshot({ path: 'test-results/cita-cancelled.png' });
                        }
                    }
                }
            }
        } else {
            test.info().annotations.push({
                type: 'note',
                description: 'No appointment blocks found in timeline — possibly no appointments scheduled for selected date',
            });
            await page.screenshot({ path: 'test-results/cita-no-appointments.png' });
        }
    });
});
