#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE import actionable targets contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });

  // ── 1. First look must lead with one clear action and hide heavy workbench ─
  const startHero = page.locator('[data-testid="ide-import-start-hero"]').first();
  const startPrimary = page.locator('[data-testid="ide-import-start-primary"]').first();

  assert(await visible(startHero), 'Import start hero must be visible on first look');
  assert(await visible(startPrimary), 'Import start primary CTA must be visible on first look');

  // ── 2. Primary CTA should trigger ZIP chooser when ZIP is the active entry ─
  const primaryLabel = (await startPrimary.textContent().catch(() => ''))?.toLowerCase() ?? '';
  if (primaryLabel.includes('zip')) {
    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        startPrimary.click(),
      ]);
      assert(fileChooser !== null && fileChooser !== undefined, 'Import ZIP entry CTA must trigger a file chooser');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(false, `Import ZIP entry CTA did not trigger file chooser: ${message}`);
    }
  }

  // ── 3. Alternate path should open HDL editor via disclosure ─────────────────
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });

  const otherOptions = page.locator('[data-testid="ide-import-start-other-options"]').first();
  if (await visible(otherOptions)) {
    const startSecondary = page.locator('[data-testid="ide-import-start-secondary"]').first();
    assert(await visible(startSecondary), 'visible Import alternatives must expose Paste HDL directly');
    await startSecondary.click();
  } else {
    const startSecondary = page.locator('[data-testid="ide-import-start-secondary"]').first();
    if (await visible(startSecondary)) {
      await startSecondary.click();
    } else {
      const dockSecondary = page.locator('[data-testid="ide-import-dock-secondary"]').first();
      assert(await visible(dockSecondary), 'Import alternate start action must be reachable from hero or dock');
      await dockSecondary.click();
    }
  }

  const hdlTextarea = page.locator('[data-testid="ide-import-hdl-textarea"]').first();
  await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });
  assert(await visible(hdlTextarea), 'HDL textarea must be visible after choosing alternate start path');

  const workbenchAfterStart = page.locator('[data-testid="ide-import-workbench"]').first();
  assert(await visible(workbenchAfterStart), 'Import workbench must appear after choosing a start path');

  // ── 4. Parse summary not shown before any parse ───────────────────────────
  const summaryBefore = page.locator('[data-testid="ide-import-parse-summary"]').first();
  const summaryVisible = await visible(summaryBefore);
  assert(!summaryVisible, 'parse summary must not be visible before any HDL is parsed');

  // ── 5. Process button should remain disabled before parse completes ─────────
  const processBtn = page.locator('[data-testid="ide-import-process-design"]').first();
  await page.waitForSelector('[data-testid="ide-import-process-design"]', { timeout: 10000 });
  const processDisabled = await processBtn.getAttribute('disabled').catch(() => null);
  assert(processDisabled !== null, 'Process Design button must start disabled before any parse');

  const reasonBefore = page.locator('[data-testid="ide-import-apply-disabled-reason"]').first();
  assert(
    !(await visible(reasonBefore)),
    'disabled reason must not appear before any HDL is parsed (hasParsedHdl=false)'
  );
});

