import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const bookingUrl = pathToFileURL(resolve(process.cwd(), '../web/citas.html')).toString();

async function mockSupabaseRest(
  page: import('@playwright/test').Page,
  handler: (table: string, url: URL) => unknown
) {
  await page.route('https://xzgacnyauehyutdojfzo.supabase.co/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.replace('/rest/v1/', '').split('/')[0];
    const body = handler(table, url);

    if (body instanceof Error) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: body.message }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

// NOTE: These tests are skipped because the public booking flow has been migrated
// to the portal Next.js app (/portal/reservar). The web/citas.html page no longer
// includes the interactive booking widget (booking.js). These tests need to be
// rewritten to target the portal booking flow instead.
test.describe.skip('public booking flow', () => {
  test('does not show fallback professionals when a service has no linked professional', async ({ page }) => {
    let professionalsRequests = 0;

    await mockSupabaseRest(page, (table) => {
      if (table === 'service_categories') {
        return [{
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Fisioterapia',
          description: 'Tratamientos de fisioterapia',
        }];
      }
      if (table === 'booking_settings') return [{ booking_advance_days: 30, min_booking_notice_hours: 0 }];
      if (table === 'services') {
        return [{
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Fisio sin profesional',
          description: 'Servicio pendiente de asignar',
          duration_minutes: 50,
          price: 45,
        }];
      }
      if (table === 'professional_services') return [];
      if (table === 'professionals') {
        professionalsRequests += 1;
        return [{
          id: '33333333-3333-3333-3333-333333333333',
          first_name: 'No',
          last_name: 'Debe aparecer',
          is_active: true,
        }];
      }
      return [];
    });

    await page.goto(bookingUrl);
    await page.getByRole('radio', { name: /Fisioterapia/i }).click();
    await page.getByRole('radio', { name: /Fisio sin profesional/i }).click();

    await expect(page.getByText('No hay profesionales disponibles para este servicio')).toBeVisible();
    expect(professionalsRequests).toBe(0);
  });

  test('shows a recoverable error when services cannot be loaded', async ({ page }) => {
    await mockSupabaseRest(page, (table) => {
      if (table === 'service_categories') {
        return [{
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Fisioterapia',
          description: 'Tratamientos de fisioterapia',
        }];
      }
      if (table === 'booking_settings') return [{ booking_advance_days: 30, min_booking_notice_hours: 0 }];
      if (table === 'services') return new Error('services unavailable');
      return [];
    });

    await page.goto(bookingUrl);
    await page.getByRole('radio', { name: /Fisioterapia/i }).click();

    await expect(page.getByText('No hemos podido cargar los servicios')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('uses slot RPC even when public schedule slots are not readable', async ({ page }) => {
    await mockSupabaseRest(page, (table, url) => {
      if (table === 'service_categories') {
        return [{
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Fisioterapia',
          description: 'Tratamientos de fisioterapia',
        }];
      }
      if (table === 'booking_settings') return [{ booking_advance_days: 30, min_booking_notice_hours: 0 }];
      if (table === 'services') {
        return [{
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Fisioterapia General',
          description: 'Tratamiento manual',
          duration_minutes: 50,
          price: 45,
        }];
      }
      if (table === 'professional_services') {
        return [{ professional_id: '33333333-3333-3333-3333-333333333333' }];
      }
      if (table === 'professionals') {
        return [{
          id: '33333333-3333-3333-3333-333333333333',
          first_name: 'Profesional',
          last_name: 'Con agenda',
          is_active: true,
        }];
      }
      if (table === 'schedule_slots') return [];
      if (table === 'schedule_exceptions') return [];
      if (table === 'rpc' && url.pathname.endsWith('/rpc/get_available_slots')) {
        return [
          {
            slot_start: '2026-04-27T09:00:00+02:00',
            slot_end: '2026-04-27T09:50:00+02:00',
          },
        ];
      }
      return [];
    });

    await page.goto(bookingUrl);
    await page.getByRole('radio', { name: /Fisioterapia/i }).click();
    await page.getByRole('radio', { name: /Fisioterapia General/i }).click();
    await page.getByRole('radio', { name: /Profesional Con agenda/i }).click();

    const firstSelectableDay = page.locator('#calendar-grid .calendar__day[onclick]').first();
    await expect(firstSelectableDay).toBeVisible();
    await firstSelectableDay.click();

    await expect(page.getByRole('button', { name: '09:00' })).toBeVisible();
  });
});
