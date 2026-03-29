#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function setBinaryInput(page, nodeId, target) {
  const rowValueLocator = page.locator(`[data-testid="ide-design-live-input-${nodeId}"] code`).first();
  await page.waitForSelector(`[data-testid="switch-toggle-${nodeId}"]`, { timeout: 10000 });
  const before = await text(rowValueLocator);
  if (before === String(target)) return;
  await page.evaluate((id) => {
    const toggle = document.querySelector(`[data-testid="switch-toggle-${id}"]`);
    if (!toggle) return;
    toggle.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
    );
  }, nodeId);
  await page.waitForFunction(
    ({ id, value }) => {
      const row = document.querySelector(`[data-testid="ide-design-live-input-${id}"] code`);
      if (!row) return false;
      return (row.textContent || '').trim() === String(value);
    },
    { id: nodeId, value: target },
    { timeout: 10000 }
  );
}

await runIdeGate('IDE live simulation contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-design-live-sim-section-toggle"]').click();
  await page.waitForSelector('[data-testid="ide-design-live-state-table"]', { timeout: 10000 });

  // Fit the circuit into view so that viewport-culled switch nodes become visible.
  const fitButton = page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first();
  await fitButton.evaluate((button) => button.click());

  const inputCount = await page.locator('[data-testid^="ide-design-live-input-"]').count();
  const outputCount = await page.locator('[data-testid^="ide-design-live-output-"]').count();
  assert(inputCount >= 1, `expected at least 1 live input row, found ${inputCount}`);
  assert(outputCount >= 1, `expected at least 1 live output row, found ${outputCount}`);

  const tickBefore = Number.parseInt(
    (await text(page.locator('[data-testid="ide-design-sim-tick"]'))) || '0',
    10
  );
  await page.locator('[data-testid="ide-design-sim-step"]').click();
  await page.waitForFunction(
    (before) => {
      const node = document.querySelector('[data-testid="ide-design-sim-tick"]');
      if (!node) return false;
      const tick = Number.parseInt((node.textContent || '0').trim(), 10);
      return Number.isFinite(tick) && tick >= before;
    },
    tickBefore,
    { timeout: 10000 }
  );

  const tickAfter = Number.parseInt(
    (await text(page.locator('[data-testid="ide-design-sim-tick"]'))) || '0',
    10
  );
  assert(Number.isFinite(tickAfter), 'simulation tick should remain numeric after step');

  const lastChange = await text(page.locator('[data-testid="ide-design-last-change"]'));
  assert(lastChange.length > 0, 'live simulation should provide a last-change summary');
});
