#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE persistence contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay and seed an empty circuit so the
  // empty-state "Add IO Pins" button is always visible regardless of default example.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    const empty = {
      state: {
        projectId: 'gate-persistence-test',
        projectName: 'Gate Test',
        projectDescription: '',
        lastSavedAt: new Date().toISOString(),
        activeExampleId: null,
        projectIoRows: [],
        projectVectors: [],
        circuit: { nodes: [], connections: [] },
        verifyRunHistory: [],
        sim: {
          tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
          inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
        },
        projectHealthCore: {
          lastVerify: null, lastExport: null,
          dirtySinceVerify: false, dirtySinceExport: false,
        },
        customComponents: [],
      },
      version: 4,
    };
    localStorage.setItem('rb.ide.project-runtime.v1', JSON.stringify(empty));
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const beforeNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? 0;
  });
  await page.locator('[data-testid="ide-design-empty-add-io"]').click();
  await page.waitForSelector('[data-testid="ide-design-action-toast"]', { timeout: 10000 });
  await page.waitForFunction(
    (before) => {
      const store = window.__RB_CIRCUIT_STORE__;
      const nodes = store?.getState?.().circuit?.nodes?.length ?? 0;
      return nodes > before;
    },
    beforeNodeCount,
    { timeout: 10000 }
  );

  const afterNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? 0;
  });
  assert(afterNodeCount > beforeNodeCount, 'design mutation should increase node count');

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const hashBeforeReload = await text(page.locator('[data-testid="ide-project-hash-short"]'));
  assert(hashBeforeReload.length > 0, 'project hash should be visible before reload');

  await page.waitForTimeout(400);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

  const hashAfterReload = await text(page.locator('[data-testid="ide-project-hash-short"]'));
  assert(hashAfterReload.length > 0, 'project hash should be visible after reload');

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const persistedNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? 0;
  });
  assert(
    persistedNodeCount === afterNodeCount,
    `mutated design should persist across reload (expected ${afterNodeCount}, got ${persistedNodeCount})`
  );
});
