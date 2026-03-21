#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function placePaletteEntry(page, selector, xFactor, yFactor) {
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

await runIdeGate('IDE design build-fast contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Suppress the first-visit onboarding overlay and seed an empty circuit so board
  // palette chips are unplaced and available to click.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    const empty = {
      state: {
        projectId: 'gate-build-fast-test', projectName: 'Gate Test', projectDescription: '',
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

  // Board-first palette: selecting board chips enters placement mode, then clicking
  // blank canvas commits the Switch/Lamp nodes into the circuit.
  await placePaletteEntry(page, '[data-testid="ide-design-board-input-sw0"]', 0.22, 0.34);
  await placePaletteEntry(page, '[data-testid="ide-design-board-input-sw1"]', 0.22, 0.56);
  await placePaletteEntry(page, '[data-testid="ide-design-board-output-ld0"]', 0.66, 0.45);
  const paletteToast = await text(page.locator('[data-testid="ide-design-action-toast"]'));
  assert(
    paletteToast.toLowerCase().includes('added'),
    'board-first palette should confirm node insertion via toast'
  );

  // Wire tool must be visible and create a wire-mode cue when clicked.
  const startWire = page.locator('[data-testid="ide-design-tool-wire"]');
  assert(await visible(startWire), 'start wire shortcut control must be visible');
  await startWire.click();
  const wireCue = page.locator('[data-testid="ide-design-wire-cue"]');
  assert(await visible(wireCue), 'wire cue must appear when wire mode is active');

  // SW0 and SW1 are Switch nodes — their on-canvas toggle handles appear automatically.
  await page.waitForSelector('[data-testid^="switch-toggle-"]', { timeout: 10000 });

  const toggles = page.locator('[data-testid^="switch-toggle-"]:not([data-testid$="-container"])');
  const toggleCount = await toggles.count();
  assert(toggleCount >= 2, `expected at least two switch toggles, got ${toggleCount}`);
  await toggles.nth(0).click();
  await toggles.nth(1).click();

  // Live simulation is tucked behind a collapsible inspector section in the current
  // workspace; open it before validating the live output table and stepping controls.
  await page.locator('[data-testid="ide-design-live-sim-section-toggle"]').click();

  // LD0 (Lamp) creates a live-output entry in the live simulation table as soon as it is placed.
  await page.waitForSelector('[data-testid^="ide-design-live-output-"]', { timeout: 10000 });

  const tickBeforeStep = Number.parseInt(await text(page.locator('[data-testid="ide-design-sim-tick"]')), 10);
  await page.locator('[data-testid="ide-design-sim-step"]').click();
  const tickAfterStep = Number.parseInt(await text(page.locator('[data-testid="ide-design-sim-tick"]')), 10);
  assert(
    Number.isFinite(tickBeforeStep) && Number.isFinite(tickAfterStep),
    `simulation tick should remain numeric (before=${tickBeforeStep}, after=${tickAfterStep})`
  );
  assert(
    tickAfterStep >= tickBeforeStep,
    `simulation tick should not regress after step (before=${tickBeforeStep}, after=${tickAfterStep})`
  );

  const lastChange = await text(page.locator('[data-testid="ide-design-last-change"]'));
  const normalizedLastChange = lastChange.toLowerCase();
  assert(lastChange.length > 0, 'last-change summary should be present after step');
  assert(
    /tick\s+\d+/i.test(lastChange) || normalizedLastChange.includes('no runtime samples yet'),
    `last-change should report tick context or explicit no-samples state (actual: "${lastChange}")`
  );
});
