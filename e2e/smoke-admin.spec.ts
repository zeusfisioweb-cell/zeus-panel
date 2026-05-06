import { expect, test, type Browser } from '@playwright/test';
import { loginAsAdmin } from './helpers';

const ROUTES = [
    { path: '/',               ready: '.zs-dash-header__title',  label: 'dashboard' },
    { path: '/citas',          ready: '.zs-ch-wrap',             label: 'citas' },
    { path: '/pacientes',      ready: '.zs-pac-header',          label: 'pacientes' },
    { path: '/profesionales',  ready: '.zs-pros-header__title',  label: 'profesionales' },
    { path: '/servicios',      ready: '.zs-svc-header',          label: 'servicios' },
    { path: '/horarios',       ready: '.zs-hor-header__title',   label: 'horarios' },
    { path: '/analitica',      ready: 'h1',                      label: 'analitica' },
    { path: '/configuracion',  ready: '.zs-cfg-header',          label: 'configuracion' },
] as const;

const VIEWPORTS = [
    { width: 390,  height: 844,  name: '390' },
    { width: 768,  height: 1024, name: '768' },
    { width: 1366, height: 768,  name: '1366' },
    { width: 1920, height: 1080, name: '1920' },
] as const;

test.describe('admin smoke — navigation', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run admin smoke.',
    );

    test('all admin routes load their primary element', async ({ page }) => {
        test.slow();
        await loginAsAdmin(page);

        for (const route of ROUTES) {
            await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
            await expect(
                page.locator(route.ready).first(),
                `route ${route.path}: ready selector ${route.ready} not visible`,
            ).toBeVisible({ timeout: 25_000 });
        }
    });

    test('unauthenticated requests redirect to /login', async ({ browser }) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();
        try {
            for (const route of ROUTES) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
                await expect(page, `route ${route.path} should redirect`).toHaveURL(/\/login$/, { timeout: 10_000 });
            }
        } finally {
            await context.close();
        }
    });
});

test.describe('admin smoke — responsive screenshots', () => {
    test.skip(
        !process.env.PANEL_E2E_EMAIL || !process.env.PANEL_E2E_PASSWORD,
        'Set PANEL_E2E_EMAIL and PANEL_E2E_PASSWORD to run responsive screenshots.',
    );

    for (const vp of VIEWPORTS) {
        test(`${vp.name}px — all routes screenshot`, async ({ browser }: { browser: Browser }) => {
            const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
            const page = await context.newPage();

            await loginAsAdmin(page);

            for (const route of ROUTES) {
                await page.goto(route.path);
                await expect(
                    page.locator(route.ready).first(),
                    `route ${route.path} at ${vp.name}px: ready selector not visible`,
                ).toBeVisible({ timeout: 15_000 });

                await page.screenshot({
                    path: `test-results/responsive-${route.label}-${vp.name}px.png`,
                    fullPage: true,
                });
            }

            await context.close();
        });
    }
});
