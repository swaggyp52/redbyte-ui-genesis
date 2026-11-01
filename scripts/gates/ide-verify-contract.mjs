#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE verify contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 10000 });

  await ensureVerifyVectorsReady(page);
  assert(
    await setVerifyRunMode(page, 'compare'),
    'verify contract requires the current surface to expose Compare checks'
  );
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });

  const statusText = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim();
  assert(
    isVerifyPass(statusText),
    `logic-gates starter should reach a passing Compare state, got "${statusText}"`
  );

  assert(
    await visible(page.locator('[data-testid="ide-verify-command-bar"]').first()),
    'verify command bar must remain visible after a Compare run'
  );
  assert(
    await visible(page.locator('[data-testid="ide-verify-workspace-waveform"]').first()),
    'verify waveform workspace must render after a Compare run'
  );
  const recordingBefore = await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun));
  await page.getByTestId('ide-verify-view-table').click();
  await page.locator('[data-testid^="ide-case-lab-exp-"]').first().waitFor({ state: 'visible' });
  const checkedCells = await page.evaluate(() => {
    const vectors = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? [];
    return vectors.flatMap(vector => Object.entries(vector.expected ?? {}).map(([id, value]) => {
      const cell = document.querySelector(`[data-testid="ide-case-lab-exp-${vector.tick}-${id}"]`);
      return { id, tick: vector.tick, value: String(value), text: cell?.textContent?.trim() ?? '', visible: Boolean(cell && cell.getBoundingClientRect().height > 0) };
    }));
  });
  assert(checkedCells.length > 0, 'starter must retain configured expected-output checks');
  assert(checkedCells.every(cell => cell.visible && cell.text === cell.value),
    `case table must expose exact authored expected outputs: ${JSON.stringify(checkedCells)}`);
  const recordingAfter = await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun));
  assert(recordingAfter === recordingBefore, 'switching to expected-check authoring must preserve recorded evidence');
});
