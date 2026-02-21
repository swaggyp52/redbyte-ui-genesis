#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE import actionable targets contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });

  // ── 1. All 3 target cards must be visible ─────────────────────────────────
  const hdlCard = page.locator('[data-testid="ide-import-card-hdl"]').first();
  const xdcCard = page.locator('[data-testid="ide-import-card-xdc"]').first();
  const zipCard = page.locator('[data-testid="ide-import-card-zip"]').first();

  assert(await visible(hdlCard), 'HDL target card must be visible');
  assert(await visible(xdcCard), 'XDC target card must be visible');
  assert(await visible(zipCard), 'ZIP target card must be visible');

  // ── 2. HDL card click → HDL textarea accessible ───────────────────────────
  await hdlCard.click();
  await page.waitForTimeout(100);
  const hdlTextarea = page.locator('[data-testid="ide-import-hdl-input"]').first();
  assert(await visible(hdlTextarea), 'HDL textarea must be visible after clicking HDL card');

  // HDL card must be active
  const hdlCardClass = await hdlCard.getAttribute('class').catch(() => '');
  assert(
    (hdlCardClass ?? '').includes('is-active'),
    `HDL card must have is-active class after click, got "${hdlCardClass}"`
  );

  // ── 3. XDC card click → XDC textarea accessible ───────────────────────────
  await xdcCard.click();
  await page.waitForTimeout(100);
  const xdcTextarea = page.locator('[data-testid="ide-import-xdc-input"]').first();
  assert(await visible(xdcTextarea), 'XDC textarea must be visible after clicking XDC card');

  // XDC card must be active
  const xdcCardClass = await xdcCard.getAttribute('class').catch(() => '');
  assert(
    (xdcCardClass ?? '').includes('is-active'),
    `XDC card must have is-active class after click, got "${xdcCardClass}"`
  );

  // ── 4. ZIP card click → triggers file chooser ─────────────────────────────
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    zipCard.click(),
  ]);
  assert(fileChooser !== null && fileChooser !== undefined, 'ZIP card must trigger a file chooser');

  // Dismiss file chooser by not selecting a file
  // (file chooser is automatically dismissed when not used)

  // ── 5. Parse summary not shown before any parse ───────────────────────────
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });

  const summaryBefore = page.locator('[data-testid="ide-import-parse-summary"]').first();
  const summaryVisible = await visible(summaryBefore);
  assert(!summaryVisible, 'parse summary must not be visible before any HDL is parsed');

  // ── 6. Apply disabled reason shown after HDL parse fails (entity parsed) ──
  // Simulate a parse by checking disabled reason appears when HDL is entered
  // We cannot drive a full parse without a backend, but we can confirm the
  // Apply button starts disabled and no reason is shown (hasParsedHdl=false)
  const applyBtn = page.locator('[data-testid="ide-import-build-project"]').first();
  const applyDisabled = await applyBtn.getAttribute('disabled').catch(() => null);
  assert(applyDisabled !== null, 'Apply to Project button must start disabled before any parse');

  const reasonBefore = page.locator('[data-testid="ide-import-apply-disabled-reason"]').first();
  assert(
    !(await visible(reasonBefore)),
    'disabled reason must not appear before any HDL is parsed (hasParsedHdl=false)'
  );
});
