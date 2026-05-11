import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin as login } from './helpers';

const email = process.env.PANEL_E2E_EMAIL;
const password = process.env.PANEL_E2E_PASSWORD;

async function expectSurface(page: Page, selector: string, expected: 'flat' | 'elevated') {
    const target = page.locator(selector).first();
    const count = await page.locator(selector).count();
    if (count === 0) return;

    await expect(target).toBeVisible();

    const boxShadow = await target.evaluate((node: Element) => getComputedStyle(node).boxShadow);
    const isFlat =
        boxShadow === 'none' ||
        /^rgba?\(0,\s*0,\s*0,\s*0\)\s+0px\s+0px\s+0px\s+0px$/.test(boxShadow);
    expect(isFlat).toBe(expected === 'flat');
}

test.describe('card redesign visual smoke', () => {
    test.skip(!email || !password, 'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run redesign smoke.');

    test('desktop routes keep intentional card surfaces', async ({ page }) => {
        test.slow();
        await login(page);

        const routes = [
            { path: '/citas', ready: '.zs-ch-wrap', surface: '.zc-vcal', expected: 'flat' },
            { path: '/pacientes', ready: '.zs-pac-header', surface: '.zs-pac-table-card', expected: 'flat' },
            { path: '/profesionales', ready: '.zs-pros-header__title', surface: '.zs-pro-card', expected: 'elevated' },
            { path: '/servicios', ready: '.zs-svc-header', surface: '.zs-svc-tile', expected: 'elevated' },
            { path: '/horarios', ready: '.zs-hor-header__title', surface: '.schedule-card', expected: 'flat' },
            { path: '/configuracion', ready: '[data-testid="settings-page"]', surface: '.settings-panel', expected: 'flat' },
        ] as const;

        for (const route of routes) {
            await page.goto(route.path);
            await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 15_000 });
            await expectSurface(page, route.surface, route.expected);
            await page.screenshot({
                path: `test-results/redesign-${route.path.replace('/', '') || 'root'}-desktop.png`,
                fullPage: true,
            });
        }
    });

    test('mobile snapshot sanity for redesigned modules', async ({ browser }) => {
        test.slow();
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();

        await login(page);

        const routes = [
            { path: '/citas', ready: '.zs-ch-wrap' },
            { path: '/pacientes', ready: '.zs-pac-header' },
            { path: '/configuracion', ready: '[data-testid="settings-page"]' },
        ] as const;

        for (const route of routes) {
            await page.goto(route.path);
            await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 15_000 });
            await page.screenshot({
                path: `test-results/redesign-${route.path.replace('/', '') || 'root'}-mobile.png`,
                fullPage: true,
            });
        }

        await context.close();
    });
});
