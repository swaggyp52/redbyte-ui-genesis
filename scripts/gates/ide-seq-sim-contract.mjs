#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

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

async function setBinaryInput(page, nodeId, target) {
  const selector = `[data-testid="ide-design-input-toggle-${nodeId}"]`;
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
  const beforePressed = await page.locator(selector).first().getAttribute('aria-pressed');
  const before = beforePressed === 'true' ? '1' : beforePressed === 'false' ? '0' : '';
  if (before === String(target)) return;
  await page.locator(selector).first().click();
  await page.waitForFunction(
    ({ id, value }) => {
      const button = document.querySelector(`[data-testid="ide-design-input-toggle-${id}"]`);
      if (!button) return false;
      const current = button.getAttribute('aria-pressed') === 'true' ? '1' : '0';
      return current === String(value);
    },
    { id: nodeId, value: target },
    { timeout: 10000 }
  );
}

await runIdeGate('IDE sequential simulation contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    const circuit = {
      state: {
        projectId: 'gate-seq-sim-test', projectName: 'Gate Test', projectDescription: '',
        lastSavedAt: new Date().toISOString(), activeExampleId: null,
        projectIoRows: [
          { id: 'd_io',  nodeId: 'd_in',  port: 'out', label: 'D',   direction: 'in',  pin: 'V17' },
          { id: 'q_io',  nodeId: 'q_out', port: 'in',  label: 'Q',   direction: 'out', pin: 'U16' },
        ],
        projectVectors: [],
        circuit: {
          nodes: [
            { id: 'd_in',    type: 'Switch',     x: 100, y: 150, position: { x: 100, y: 150 },
              config: {}, state: { isOn: 0 } },
            { id: 'clk_in',  type: 'Switch',     x: 100, y: 280, position: { x: 100, y: 280 },
              config: {}, state: { isOn: 1 } },
            { id: 'dff_node', type: 'DFlipFlop', x: 300, y: 200, position: { x: 300, y: 200 },
              config: {}, state: {} },
            { id: 'q_out',   type: 'OUTPUT',     x: 500, y: 200, position: { x: 500, y: 200 },
              config: {}, state: {} },
          ],
          connections: [
            { id: 'wire-d-dff', from: { nodeId: 'd_in',     portName: 'out' }, to: { nodeId: 'dff_node', portName: 'D'   } },
            { id: 'wire-clk-dff', from: { nodeId: 'clk_in',   portName: 'out' }, to: { nodeId: 'dff_node', portName: 'CLK' } },
            { id: 'wire-dff-q', from: { nodeId: 'dff_node', portName: 'Q'   }, to: { nodeId: 'q_out',    portName: 'in'  } },
          ],
        },
        verifyRunHistory: [],
        sim: { tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
               inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [] },
        projectHealthCore: { lastVerify: null, lastExport: null,
                             dirtySinceVerify: false, dirtySinceExport: false },
        customComponents: [],
      },
      version: 5,
    };
    localStorage.setItem('rb.ide.project-runtime.v1', JSON.stringify(circuit));
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const fitButton = page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first();
  await fitButton.evaluate((button) => button.click());
  await openQuickInputs(page);

  const inputIds = await page.$$eval('[data-testid^="ide-design-input-toggle-"]', (rows) =>
    rows
      .map((entry) => (entry.getAttribute('data-testid') || '').replace(/^ide-design-input-toggle-/, ''))
      .filter(Boolean)
  );
  const dataInputId =
    inputIds.find((entry) => /dff_data|_data|(^d_in$)|(^d$)/i.test(entry)) ??
    inputIds.find((entry) => !/clk/i.test(entry)) ??
    inputIds[0];
  assert(Boolean(dataInputId), 'expected at least one live input for sequential example');

  await setBinaryInput(page, dataInputId, 1);
  const inputCount = await page.locator('[data-testid^="ide-design-input-toggle-"]').count();
  assert(inputCount >= 2, `expected data and clock quick inputs for sequential circuit, got ${inputCount}`);
  await setBinaryInput(page, dataInputId, 0);
});
