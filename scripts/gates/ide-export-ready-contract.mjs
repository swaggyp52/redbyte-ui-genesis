#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE export ready contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-project-open-example-and-gate-basics"]').click();
  const replaceModalVisible = await page
    .locator('[data-testid="ide-example-confirm-modal"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (replaceModalVisible) {
    await page.locator('[data-testid="ide-example-confirm"]').click();
  }

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-verify-vector-pass"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(status && /PASS/i.test(status.textContent || ''));
    },
    { timeout: 10000 }
  );

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-status-strip"]', { timeout: 10000 });

  const statusStrip = await text(page.locator('[data-testid="ide-export-status-strip"]'));
  assert(statusStrip.toUpperCase().includes('READY'), 'export status strip must report READY');
  assert(
    statusStrip.toUpperCase().includes('PASS'),
    'export status strip must report verify PASS reliability'
  );

  const requiredArtifacts = [
    'top-vhd',
    'top-xdc',
    'testbench-vhd',
    'readme-txt',
    'vivado-import-tcl',
  ];
  for (const artifactId of requiredArtifacts) {
    const artifact = page.locator(
      `[data-testid="ide-export-artifact-tree-item-${artifactId}"]`
    );
    assert(await visible(artifact), `missing required artifact tree item: ${artifactId}`);
  }
});
