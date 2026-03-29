#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function placeBoardInput(page, selector, xFactor, yFactor) {
  await page.locator(selector).first().click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvas?.getAttribute('data-placement-active') === '1';
  }, { timeout: 5000 });

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), `design canvas bounds unavailable for placement from ${selector}`);
  await page.mouse.click(bounds.x + bounds.width * xFactor, bounds.y + bounds.height * yFactor);

  await page.waitForFunction(() => {
    const canvasEl = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvasEl?.getAttribute('data-placement-active') === '0';
  }, { timeout: 5000 });
}

await runIdeGate('IDE design live sim contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Suppress the first-visit onboarding overlay and seed an empty circuit so board
  // palette chips are unplaced and available to click.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    const empty = {
      state: {
        projectId: 'gate-live-sim-test', projectName: 'Gate Test', projectDescription: '',
        lastSavedAt: new Date().toISOString(), activeExampleId: null,
        projectIoRows: [], projectVectors: [], circuit: { nodes: [], connections: [] },
        verifyRunHistory: [],
        sim: { tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
               inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [] },
        projectHealthCore: { lastVerify: null, lastExport: null,
                             dirtySinceVerify: false, dirtySinceExport: false },
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
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-design-live-sim-section-toggle"]').click();

  const boardPalette = page.locator('[data-testid="ide-design-board-io-palette"]').first();
  const boardPaletteVisible = await boardPalette.isVisible().catch(() => false);
  if (!boardPaletteVisible) {
    await page.locator('[data-testid="ide-design-palette-toggle-board"]').first().click();
    await boardPalette.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Place two switch inputs from the board palette — they render switch-toggle-* handles
  // and create live-input-* rows in the inspector.
  await placeBoardInput(page, '[data-testid="ide-design-board-input-sw0"]', 0.24, 0.38);
  await placeBoardInput(page, '[data-testid="ide-design-board-input-sw1"]', 0.24, 0.58);
  await page.waitForSelector('[data-testid^="switch-toggle-"]', { timeout: 10000 });

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
