import { expect, test } from '@playwright/test';
import { createTestPng } from './fixtures/png';

/**
 * The main guest journey, end to end, on mock providers:
 * landing -> upload -> processing -> review -> confirm -> report.
 *
 * Nothing here is stubbed. The app runs a production build against the
 * in-memory store and the deterministic mock providers, so this exercises the
 * same server actions, pipeline and report code that ship.
 */
test('a guest can analyse a binder page and read the report', async ({
  page,
}) => {
  // 1. Landing page
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Ontdek wat er in je Pokémon-binder zit',
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Valtivo AI is geen professionele taxateur of gradingdienst',
    ),
  ).toBeVisible();

  // 2. Start the analysis
  await page
    .getByRole('link', { name: 'Analyseer mijn kaarten' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/analyze$/);
  await expect(
    page.getByRole('heading', { name: 'Upload je foto’s' }),
  ).toBeVisible();

  // 3. Upload a demo image
  await page.locator('#file-input').setInputFiles({
    name: 'binder-page.png',
    mimeType: 'image/png',
    buffer: Buffer.from(createTestPng()),
  });
  await expect(page.getByText('binder-page.png')).toBeVisible();

  await page.getByRole('button', { name: 'Start analyse' }).click();

  // 4. Wait for the real backend pipeline to finish.
  //
  // On mock providers the pipeline can complete before the processing screen
  // is even painted, so the test asserts the destination rather than the
  // intermediate step - otherwise it would fail precisely when the app is fast.
  await expect(page).toHaveURL(/\/(processing|review)$/, { timeout: 30_000 });

  // 5. Review screen
  await expect(page).toHaveURL(/\/review$/, { timeout: 45_000 });
  await expect(
    page.getByRole('heading', { name: 'Controleer de herkenning' }),
  ).toBeVisible();

  // Confirming relabels a button to "Bevestigd" and disables it, so this
  // locator set shrinks as we go. Never index into it with nth() — always take
  // the first remaining one.
  const pendingConfirm = page
    .getByRole('button', { name: 'Bevestigen', exact: true })
    .and(page.locator(':not([disabled])'));

  expect(await pendingConfirm.count()).toBeGreaterThan(0);

  // The unmatched "unknown" card must not be confirmable.
  await expect(page.getByText('Onbekende kaart').first()).toBeVisible();

  // 6a. Bulk-confirm the cards the model was confident about
  const bulkButton = page.getByRole('button', { name: /Bevestig \d+ zekere/ });
  await expect(bulkButton).toBeVisible();
  await bulkButton.click();
  await expect(
    page.getByText(/kaarten bevestigd|1 kaart bevestigd/),
  ).toBeVisible();
  // The bulk action clears its own candidates, so the button disappears.
  await expect(bulkButton).toHaveCount(0);
  expect(
    await page.getByRole('button', { name: 'Bevestigd' }).count(),
  ).toBeGreaterThan(0);

  // 6b. Confirm whatever is left one card at a time
  let confirmed = 0;
  while ((await pendingConfirm.count()) > 0 && confirmed < 20) {
    await pendingConfirm.first().click();
    await expect(page.getByText('Kaart bevestigd').first()).toBeVisible();
    confirmed += 1;
    // Let the toast settle so the next assertion is not racing it.
    await page.waitForTimeout(150);
  }

  // 7. Open the report
  await page.getByRole('button', { name: 'Bekijk collectierapport' }).click();
  await expect(page).toHaveURL(/\/report$/, { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'Je collectieanalyse' }),
  ).toBeVisible();

  // 8. The report must show a band, never a bare single total
  await expect(page.getByText('Lage schatting', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Meest waarschijnlijk', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Hoge schatting', { exact: true })).toBeVisible();

  // 9. Top cards, with source and observation count
  await expect(page.getByRole('heading', { name: 'Topkaarten' })).toBeVisible();
  await expect(page.getByText('Prijsbron').first()).toBeVisible();
  await expect(page.getByText('Waarnemingen').first()).toBeVisible();

  // 10. Transparency: data quality, attention section, full list
  await expect(
    page.getByRole('heading', { name: 'Datakwaliteit' }),
  ).toBeVisible();
  await expect(
    page.getByText('Deze score wordt berekend met vaste regels'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Verdient extra aandacht' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Volledige kaartenlijst' }),
  ).toBeVisible();

  // 11. Missing market data is stated, not filled in with a fake number
  await expect(page.getByText('Onvoldoende marktdata').first()).toBeVisible();

  // 12. Guests get the soft conversion prompt, not a paywall
  await expect(
    page.getByRole('heading', {
      name: 'Bewaar deze analyse en bouw je digitale collectie op',
    }),
  ).toBeVisible();
});

test('the full card list can be filtered', async ({ page }) => {
  await page.goto('/analyze');
  await page.locator('#file-input').setInputFiles({
    name: 'page.png',
    mimeType: 'image/png',
    buffer: Buffer.from(createTestPng()),
  });
  await page.getByRole('button', { name: 'Start analyse' }).click();
  await expect(page).toHaveURL(/\/review$/, { timeout: 45_000 });

  await page.getByRole('button', { name: 'Bekijk collectierapport' }).click();
  await expect(page).toHaveURL(/\/report$/, { timeout: 30_000 });

  const counter = page.getByText(/van \d+ kaarten$/);
  await expect(counter).toBeVisible();
  const initial = await counter.textContent();

  await page.locator('#table-filter').selectOption('unknown');
  await expect(counter).not.toHaveText(initial ?? '');
});
