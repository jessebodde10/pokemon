import { expect, test } from '@playwright/test';
import { createTestPng } from './fixtures/png';

/**
 * The signed-in journey: log in, run an analysis, confirm cards, save them to
 * the collection and see them back on the dashboard.
 *
 * Runs against the development auth fallback, which is what a developer sees
 * with no Supabase project configured. The production path uses Supabase magic
 * links; both resolve to the same `AuthUser` for everything downstream.
 */
test('a signed-in user can save an analysis to their collection', async ({
  page,
}) => {
  // 1. Sign in
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible();
  await expect(
    page.getByText('Er is geen Supabase-project geconfigureerd'),
  ).toBeVisible();

  await page
    .getByLabel('E-mailadres')
    .fill(`verzamelaar-${Date.now()}@voorbeeld.nl`);
  await page.getByRole('button', { name: 'Lokaal inloggen' }).click();

  // 2. Land on the dashboard
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Je collectie is nog leeg' }),
  ).toHaveCount(0);

  // 3. Run an analysis as a signed-in user
  await page.goto('/analyze');
  await expect(page.getByText('Je werkt nu als gast')).toHaveCount(0);

  await page.locator('#file-input').setInputFiles({
    name: 'binder.png',
    mimeType: 'image/png',
    buffer: Buffer.from(createTestPng()),
  });
  await page.getByRole('button', { name: 'Start analyse' }).click();

  await expect(page).toHaveURL(/\/review$/, { timeout: 45_000 });

  // Wait for the route's loading skeleton to be replaced by real content;
  // counting buttons before that races the Suspense boundary.
  await expect(
    page.getByRole('heading', { name: 'Controleer de herkenning' }),
  ).toBeVisible({ timeout: 30_000 });

  // 4. Confirm the matched cards
  // Confirming relabels the button to "Bevestigd", so this set shrinks as we
  // go — take the first remaining one rather than indexing with nth().
  const pendingConfirm = page
    .getByRole('button', { name: 'Bevestigen', exact: true })
    .and(page.locator(':not([disabled])'));
  expect(await pendingConfirm.count()).toBeGreaterThan(0);

  let confirmed = 0;
  while ((await pendingConfirm.count()) > 0 && confirmed < 20) {
    await pendingConfirm.first().click();
    await expect(page.getByText('Kaart bevestigd').first()).toBeVisible();
    confirmed += 1;
    await page.waitForTimeout(150);
  }
  expect(confirmed).toBeGreaterThan(0);

  // 5. Open the report and save to the collection
  await page.getByRole('button', { name: 'Bekijk collectierapport' }).click();
  await expect(page).toHaveURL(/\/report$/, { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'Je collectieanalyse' }),
  ).toBeVisible({ timeout: 30_000 });

  // A signed-in user gets the save action, not the sign-up prompt.
  await expect(
    page.getByRole('heading', {
      name: 'Bewaar deze analyse en bouw je digitale collectie op',
    }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Toevoegen aan collectie' }).click();
  await expect(
    page.getByText(/kaart\(en\) toegevoegd aan je collectie/),
  ).toBeVisible({ timeout: 20_000 });

  // 6. The analysis is retained and listed
  await page.goto('/dashboard/analyses');
  await expect(
    page.getByRole('link', { name: 'Rapport' }).first(),
  ).toBeVisible();
  await expect(page.getByText('Datakwaliteit:').first()).toBeVisible();

  // 7. The collection reflects the saved cards
  await page.goto('/dashboard/collection');
  await expect(page.getByRole('heading', { name: 'Totalen' })).toBeVisible();
  await expect(page.getByText('Totale indicatieve bandbreedte')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Verdeling per set' }),
  ).toBeVisible();
});

test('dashboard routes are protected server-side', async ({ page }) => {
  await page.context().clearCookies();

  for (const route of [
    '/dashboard',
    '/dashboard/analyses',
    '/dashboard/collection',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});
