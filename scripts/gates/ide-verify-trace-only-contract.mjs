#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE verify trace-only contract', async ({ page, baseUrl }) => {
  // 1. Load the default IDE directly in verify mode — no vectors authored
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });

  // 2. Confirm empty state is visible (no run has happened yet)
  const emptyState = page.locator('[data-testid="ide-verify-empty-state"]').first();
  assert(await visible(emptyState), 'empty state must render before any run (0 vectors)');

  // 3. Confirm 0 vectors in the table
  const vectorRows = await page
    .locator('[data-testid="ide-verify-vectors-table"] tbody tr')
    .filter({ has: page.locator('code') })
    .count();
  assert(vectorRows === 0, `expected 0 authored vectors at start, got ${vectorRows}`);

  // 4. Run button must be ENABLED even with 0 vectors
  const runBtn = page.locator('[data-testid="ide-verify-run"]').first();
  assert(await visible(runBtn), 'run button must be visible in verify mode');
  const isDisabled = await runBtn.isDisabled();
  assert(!isDisabled, 'Run button must be enabled even with 0 test vectors');

  // 5. Click Run — triggers trace-only run
  await runBtn.click();

  // 6. Workbench must replace the empty state
  await page.waitForSelector('[data-testid="ide-verify-workbench"]', { timeout: 10000 });
  const workbench = page.locator('[data-testid="ide-verify-workbench"]').first();
  assert(await visible(workbench), 'verify workbench must appear after trace-only run');

  // 7. Wait for run state to leave RUNNING
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="ide-verify-run-state"]');
        return el !== null && el.textContent !== 'RUNNING';
      },
      { timeout: 15000 }
    )
    .catch(() => null);

  // 8. Status label must say TRACE ONLY
  const statusLabel = (
    await page
      .locator('[data-testid="ide-verify-status-label"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    /TRACE/i.test(statusLabel) || /ONLY/i.test(statusLabel),
    `Status label must contain TRACE or ONLY for trace-only run, got: "${statusLabel}"`
  );

  // 9. Summary status pill must say TRACE
  const summaryStatus = (
    await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    /TRACE/i.test(summaryStatus) || /ONLY/i.test(summaryStatus),
    `Summary status pill must include TRACE or ONLY, got: "${summaryStatus}"`
  );

  // 10. Waveform preview container must carry data-verify-trace-only="1"
  const waveformPreview = page.locator('[data-testid="ide-verify-waveform-preview"]').first();
  const traceOnlyAttr = await waveformPreview.getAttribute('data-verify-trace-only').catch(() => null);
  assert(
    traceOnlyAttr === '1',
    `ide-verify-waveform-preview must have data-verify-trace-only="1", got: "${traceOnlyAttr}"`
  );

  // 11. Empty-state must NOT be visible after trace-only run
  const emptyStateAfter = await page
    .locator('[data-testid="ide-verify-empty-state"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(!emptyStateAfter, 'Empty state must NOT be visible after a trace-only run');
});
