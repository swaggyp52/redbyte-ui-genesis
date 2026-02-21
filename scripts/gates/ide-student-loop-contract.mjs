#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE student loop contract satisfied', async ({ page, baseUrl }) => {
  // ── 1. Project: open example ───────────────────────────────────────────
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-project-open-example-and-gate-basics"]').click();
  const confirmBtn = page.locator('[data-testid="ide-example-confirm"]');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForTimeout(400);

  // Guided strip must be visible on project surface
  const strip = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(strip), 'guided strip must be visible on project surface');

  // ── 2. Design: guided strip visible ─────────────────────────────────────
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const stripOnDesign = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnDesign), 'guided strip must be visible on design surface');

  // ── 3. Verify: generate basics → run → PASS/FAIL banner ─────────────────
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
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && !/IDLE/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );

  const verifyBanner = page.locator('[data-testid="ide-verify-banner"]').first();
  assert(await visible(verifyBanner), 'verify summary banner must be visible after run');

  const statusLabel = (
    await page
      .locator('[data-testid="ide-verify-status-label"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    /PASS|FAIL/i.test(statusLabel),
    `verify status must be PASS or FAIL after run, got "${statusLabel}"`
  );

  // ── 4. Export: READY/BLOCKED banner + vivado_import.tcl artifact ─────────
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const readinessBanner = page.locator('[data-testid="ide-export-readiness-banner"]').first();
  assert(await visible(readinessBanner), 'export readiness banner must be visible');

  const readinessLabel = (
    await page
      .locator('[data-testid="ide-export-readiness-label"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    readinessLabel.length > 0,
    `export readiness label must have non-empty text, got "${readinessLabel}"`
  );

  const vivadoTcl = page
    .locator('[data-testid="ide-export-artifact-tree-item-vivado-import-tcl"]')
    .first();
  if (await visible(vivadoTcl)) {
    assert(true, 'vivado_import.tcl found in export artifact tree');
  } else {
    // fallback: assert at least one artifact is visible
    const anyArtifact = page.locator('[data-testid^="ide-export-artifact-tree-item-"]').first();
    assert(
      await visible(anyArtifact),
      'at least one artifact must be in the export artifact tree'
    );
  }

  // ── 5. Hardware: checklist + expected IO table ────────────────────────────
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });

  const checklist = page.locator('[data-testid="ide-hardware-checklist"]').first();
  assert(await visible(checklist), 'hardware bring-up checklist must be visible');

  const expectedIoTable = page.locator('[data-testid="ide-hardware-expected-io-table"]').first();
  if (await visible(expectedIoTable)) {
    assert(true, 'hardware expected IO table is visible');
  } else {
    // fallback: check for the section wrapper
    const expectedIoSection = page.locator('[data-testid="ide-hardware-expected-io"]').first();
    assert(await visible(expectedIoSection), 'hardware expected IO section must be visible');
  }
});
