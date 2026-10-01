#!/usr/bin/env node

import { assert, runIdeGate, openDesignBoardPalette, designInputIds, selectDesignInput } from './_gateHarness.mjs';

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
      version: 5,
    };
    localStorage.setItem('rb.ide.project-runtime.v1', JSON.stringify(empty));
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  await openDesignBoardPalette(page);

  // Construct a useful board input/output path before exercising live values.
  await placeBoardInput(page, '[data-testid="ide-design-board-input-sw0"]', 0.24, 0.38);
  await placeBoardInput(page, '[data-testid="ide-design-board-input-sw1"]', 0.24, 0.58);
  await placeBoardInput(page, '[data-testid="ide-design-board-output-ld0"]', 0.68, 0.38);
  await page.waitForSelector('[data-testid^="switch-toggle-"]', { timeout: 10000 });

  const inputIds = await designInputIds(page);
  assert(inputIds.length === 2, 'both placed switches must be addressable as circuit inputs');
  const targetId = inputIds[0];
  const outputId = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find(node => node.type === 'OUTPUT').id);
  await page.locator(`[data-testid="port-${targetId}-out"]`).click();
  await page.locator(`[data-testid="port-${outputId}-in"]`).click();
  await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.connections.length === 1);
  await page.locator('[data-testid="ide-design-explore"]').click();
  const inspectorToggle = await selectDesignInput(page, targetId);
  const before = await inspectorToggle.getAttribute('aria-pressed');
  assert(before === 'true' || before === 'false', 'selected input must expose binary value');
  const body = page.locator(`[data-testid="switch-toggle-${targetId}"]`).first();
  await body.click();
  const changed = await page.waitForFunction(({ id, previous }) => Boolean(window.__RB_PROJECT_RUNTIME__.getState().sim.inputs[id]) !== (previous === 'true'), { id: targetId, previous: before }, { timeout: 5000 }).then(() => true).catch(() => false);
  const afterEvidence = await page.evaluate(id => ({ input: window.__RB_PROJECT_RUNTIME__.getState().sim.inputs[id], node: window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find(node => node.id === id), mode: document.querySelector('[data-testid="ide-design-learning-mode"]')?.getAttribute('data-mode'), editing: window.__RB_LOGIC_VIEW_STORE__.getState().editingState }), targetId);
  assert(changed, `clicking the on-canvas input body in Explore must update canonical simulation input (before=${before}, after=${JSON.stringify(afterEvidence)})`);
  assert(await inspectorToggle.getAttribute('aria-pressed') !== before, 'on-canvas switch must update the existing inspector value');
  assert(await inspectorToggle.getAttribute('aria-pressed') === String(Boolean(afterEvidence.input)), 'inspector value must agree with canonical simulation input');
});
