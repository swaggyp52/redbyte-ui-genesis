#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE student loop contract satisfied', async ({ page, baseUrl }) => {
  // 1. Project: open the runtime examples catalog and load an example
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-project-start-dock"]', { timeout: 10000 });

  const loadRows = page.locator('[data-testid="ide-project-example-load"]');
  const loadCount = await loadRows.count();
  assert(loadCount >= 1, `expected >=1 quickstart load action, found ${loadCount}`);

  const targetLoad = loadRows.nth(loadCount > 1 ? 1 : 0);
  const targetExampleId = (await targetLoad.getAttribute('data-example-id')) ?? '';
  assert(targetExampleId.length > 0, 'example load row must carry data-example-id');

  await targetLoad.locator('button').first().click();

  const ideConfirm = page.locator('[data-testid="ide-example-confirm"]').first();
  if (await ideConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ideConfirm.click();
  } else {
    const guardrailConfirm = page.getByRole('button', { name: /load/i }).first();
    if (await guardrailConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await guardrailConfirm.click();
    }
  }
  await page.locator('.ide-modal-backdrop').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);

  if (!(await page.locator('[data-testid="ide-mode-design"]').isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  }

  await page.waitForSelector('[data-testid="ide-guided-strip"]', { timeout: 10000 });

  const stripOnDesign = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnDesign), 'guided strip must be visible on design surface');

  await page
    .locator('[data-testid^="ide-design-live-input-"]')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  // 2. Verify: generate basics -> run -> PASS/FAIL banner
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const stripOnVerify = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnVerify), 'guided strip must be visible on verify surface');

  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  assert(await visible(vectorTable), 'vector table must appear after generating basics');

  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const legacy = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '';
      const summary = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '';
      const combined = `${legacy} ${summary}`;
      return /PASS|FAIL/i.test(combined);
    },
    { timeout: 10000 },
  );

  const verifyBanner = page.locator('[data-testid="ide-verify-banner"]').first();
  assert(await visible(verifyBanner), 'verify summary banner must be visible after run');

  const statusLabel = (
    await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(async () =>
        page
          .locator('[data-testid="ide-verify-summary-status"]')
          .first()
          .textContent()
          .catch(() => ''),
      )
  )?.trim() ?? '';
  assert(
    /PASS|FAIL/i.test(statusLabel),
    `verify status must be PASS or FAIL after run, got "${statusLabel}"`,
  );

  // 3. Export: gate state + Vivado command contract
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const exportPanel = page.locator('[data-testid="ide-export-panel"]').first();
  assert(await visible(exportPanel), 'export panel must be visible');

  const gateStack = page.locator('[data-testid="ide-export-gate-stack"]').first();
  assert(await visible(gateStack), 'export gate stack must be visible');

  const hasBlockersCallout = await page
    .locator('[data-testid="ide-export-blockers-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasVivadoReadyCallout = await page
    .locator('[data-testid="ide-export-vivado-ready-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    hasBlockersCallout || hasVivadoReadyCallout,
    'export must show either blockers callout or Vivado-ready callout',
  );

  const readinessLabel = (
    await page
      .locator('[data-testid="ide-export-vivado-command"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    readinessLabel.length > 0,
    `export Vivado command/status must have non-empty text, got "${readinessLabel}"`,
  );

  const downloadBlock = page.locator('[data-testid="ide-export-download-block"]').first();
  assert(
    await visible(downloadBlock),
    'export download block must be visible',
  );

  // 4. Hardware: panel + mode controls
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });

  const hardwarePanel = page.locator('[data-testid="ide-hardware-panel"]').first();
  assert(await visible(hardwarePanel), 'hardware panel must be visible');

  const hardwareModeToggle = page.locator('[data-testid="ide-hw-mode-toggle"]').first();
  assert(
    await visible(hardwareModeToggle),
    'hardware mode toggle must be visible',
  );
});

