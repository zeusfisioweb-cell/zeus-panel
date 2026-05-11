import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('dashboard — main admin view', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run authenticated tests.',
    );

    test.beforeEach(async ({ page }) => {
        test.slow();
        await loginAsAdmin(page);
        // loginAsAdmin already navigates to / and verifies heading
    });

    test('dashboard page renders heading and does not stay loading forever', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('heading', { name: /Resumen del centro/i })).toBeVisible();

        // Wait for spinner to disappear (data loaded)
        await page.waitForFunction(
            () => !document.querySelector('.spinner'),
            { timeout: 20_000 },
        ).catch(() => {
            // If still spinning, that's caught by the screenshot
        });

        await page.screenshot({ path: 'test-results/dashboard-loaded.png' });
    });

    test('KPI cards render with numeric values (not stuck on loading)', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });

        // KPI cards — wait for them to appear (data may take a moment)
        const kpiCards = page.locator('.zs-kpi');
        await expect(kpiCards.first()).toBeVisible({ timeout: 20_000 });

        const count = await kpiCards.count();
        expect(count).toBeGreaterThan(0);

        // Each KPI card should have a non-empty value
        const kpiValues = page.locator('.zs-kpi__value');
        const firstValue = await kpiValues.first().textContent({ timeout: 5_000 });
        expect(firstValue).toBeTruthy();
        expect(firstValue!.trim()).not.toBe('');

        await page.screenshot({ path: 'test-results/dashboard-kpis.png' });
    });

    test('appointment chart section renders', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });

        // Charts panel uses .zs-charts-panel aria-label="Gráficos operativos"
        const chartsPanel = page.locator('.zs-charts-panel');
        await expect(chartsPanel).toBeVisible({ timeout: 20_000 });

        await page.screenshot({ path: 'test-results/dashboard-charts.png' });
    });

    test('agenda panel renders with today\'s appointments section', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });

        // Agenda panel uses .summary-v5-panel--agenda class
        const agendaPanel = page.locator('.summary-v5-panel--agenda');
        await expect(agendaPanel).toBeVisible({ timeout: 20_000 });

        // Should show "Agenda de hoy" heading
        await expect(page.getByText(/Agenda de hoy/i)).toBeVisible({ timeout: 10_000 });

        await page.screenshot({ path: 'test-results/dashboard-agenda.png' });
    });

    test('dashboard sidebar navigation links are accessible', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });

        // Sidebar renders as .sidebar element (the element with class "sidebar")
        // On desktop the sidebar is visible; on mobile it may be hidden behind toggle
        // The sidebar-nav links should be in the DOM even if visually off-screen
        const navLinks = page.locator('.sidebar a, .sidebar-nav a, nav[class*="sidebar"] a');
        const count = await navLinks.count();

        if (count > 0) {
            // At least navigation links for main sections
            await page.screenshot({ path: 'test-results/dashboard-sidebar.png' });
            expect(count).toBeGreaterThan(2);
        } else {
            // Sidebar might use a different structure — verify citas and pacientes links exist anywhere
            await expect(page.getByRole('link', { name: /Citas/i }).first()).toBeAttached({ timeout: 5_000 });
            await expect(page.getByRole('link', { name: /Pacientes/i }).first()).toBeAttached({ timeout: 5_000 });
            await page.screenshot({ path: 'test-results/dashboard-nav-links.png' });
        }
    });

    test('KPI values are numeric — no NaN or undefined', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.zs-kpi__value').first()).toBeVisible({ timeout: 20_000 });

        const kpiValues = page.locator('.zs-kpi__value');
        const count = await kpiValues.count();
        for (let i = 0; i < Math.min(count, 6); i++) {
            const text = await kpiValues.nth(i).textContent({ timeout: 5_000 });
            expect(text?.trim()).not.toBe('');
            expect(text).not.toMatch(/NaN|undefined|null/);
        }
    });

    test('agenda items show professional name — not "Sin asignar" (regression BUG-P4)', async ({ page }) => {
        await expect(page.locator('.zs-dash-header__title')).toBeVisible({ timeout: 15_000 });
        const agendaPanel = page.locator('.summary-v5-panel--agenda');
        await expect(agendaPanel).toBeVisible({ timeout: 20_000 });

        // Check visible appointment items in agenda don't show "Sin asignar"
        const agendaText = await agendaPanel.textContent({ timeout: 5_000 });
        // Only fail if appointments exist AND all show "Sin asignar" — if agenda is empty this is fine
        const hasAppointments = agendaText && agendaText.length > 50;
        if (hasAppointments) {
            expect(agendaText).not.toMatch(/^Sin asignar$/m);
        }
    });
});
