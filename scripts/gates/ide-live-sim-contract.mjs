#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function openQuickInputs(page) {
  const liveInputsToggle = page.locator('[data-testid="ide-design-live-inputs-toggle"]').first();
  if ((await liveInputsToggle.count()) > 0 && (await liveInputsToggle.getAttribute('aria-expanded')) === 'false') {
    await liveInputsToggle.click();
  }
  await page.locator('[data-testid^="ide-design-input-toggle-"]').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function quickInputValue(page, nodeId) {
  const pressed = await page.locator(`[data-testid="ide-design-input-toggle-${nodeId}"]`).first().getAttribute('aria-pressed');
  return pressed === 'true' ? '1' : pressed === 'false' ? '0' : '';
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

  // Fit the circuit into view so that viewport-culled switch nodes become visible.
  const fitButton = page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first();
  await fitButton.evaluate((button) => button.click());

  await openQuickInputs(page);
  const inputIds = await page.$$eval('[data-testid^="ide-design-input-toggle-"]', (rows) =>
    rows
      .map((entry) => (entry.getAttribute('data-testid') || '').replace(/^ide-design-input-toggle-/, ''))
      .filter((entry) => entry.length > 0)
  );
  assert(inputIds.length >= 1, `expected at least 1 quick input toggle, found ${inputIds.length}`);

  const targetId = inputIds[0];
  const before = await quickInputValue(page, targetId);
  assert(before === '0' || before === '1', `expected binary quick input value, got "${before}"`);
  await page.locator(`[data-testid="ide-design-input-toggle-${targetId}"]`).first().click();
  await page.waitForFunction(
    ({ id, previous }) => {
      const button = document.querySelector(`[data-testid="ide-design-input-toggle-${id}"]`);
      if (!button) return false;
      const value = button.getAttribute('aria-pressed') === 'true' ? '1' : '0';
      return value !== previous;
    },
    { id: targetId, previous: before },
    { timeout: 10000 }
  );

  const after = await quickInputValue(page, targetId);
  assert(after === '0' || after === '1', `expected binary quick input value after toggle, got "${after}"`);
});
