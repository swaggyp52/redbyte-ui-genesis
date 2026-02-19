#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE design live sim contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-design-add-and-starter"]').click();

  const tickBeforeRaw = await text(page.locator('[data-testid="ide-design-sim-tick"]'));
  const tickBefore = Number.parseInt(tickBeforeRaw || '0', 10);
  await page.locator('[data-testid="ide-design-sim-step"]').click();
  await page.waitForFunction(
    (before) => {
      const element = document.querySelector('[data-testid="ide-design-sim-tick"]');
      if (!element) return false;
      const current = Number.parseInt((element.textContent || '0').trim(), 10);
      return Number.isFinite(current) && current > before;
    },
    tickBefore,
    { timeout: 10000 }
  );

  await page.locator('[data-testid^="ide-design-live-input-"]').first().waitFor({ state: 'visible', timeout: 10000 });
  const liveInputIds = await page.$$eval('[data-testid^="ide-design-live-input-"]', (rows) =>
    rows
      .map((entry) => (entry.getAttribute('data-testid') || '').replace(/^ide-design-live-input-/, ''))
      .filter((entry) => entry.length > 0)
  );
  assert(liveInputIds.length > 0, 'expected live input rows before toggle');

  const toggleIds = await page.$$eval(
    '[data-testid^="switch-toggle-"]:not([data-testid$="-container"])',
    (rows) =>
      rows
        .map((entry) => (entry.getAttribute('data-testid') || '').replace(/^switch-toggle-/, ''))
        .filter((entry) => entry.length > 0)
  );
  const targetId = liveInputIds.find((entry) => toggleIds.includes(entry));
  assert(Boolean(targetId), 'expected a matching switch toggle for at least one live input row');

  const toggleSelector = `[data-testid="switch-toggle-${targetId}"]`;
  const targetToggle = page.locator(toggleSelector).first();
  await targetToggle.waitFor({ state: 'visible', timeout: 10000 });
  const beforeValue = await text(page.locator(`[data-testid="ide-design-live-input-${targetId}"] code`).first());
  assert(beforeValue === '0' || beforeValue === '1', `expected binary live input value, got "${beforeValue}"`);

  await page.$eval(toggleSelector, (entry) => {
    entry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForFunction(
    ({ id, previous }) => {
      const row = document.querySelector(`[data-testid="ide-design-live-input-${id}"] code`);
      if (!row) return false;
      const value = (row.textContent || '').trim();
      if (value !== '0' && value !== '1') return false;
      if (previous !== '0' && previous !== '1') return false;
      return value !== previous;
    },
    { id: targetId, previous: beforeValue },
    { timeout: 10000 }
  );
});
