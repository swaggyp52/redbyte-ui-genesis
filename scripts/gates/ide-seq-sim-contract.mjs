#!/usr/bin/env node

import { assert, runIdeGate, designInputIds, selectDesignInput } from './_gateHarness.mjs';

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
  const inputIds = await designInputIds(page);
  assert(inputIds.includes('d_in') && inputIds.includes('clk_in'), 'sequential design must expose independent data and clock inputs');
  for (const [id, values] of [['d_in', [1, 0]], ['clk_in', [0, 1]]]) {
    const toggle = await selectDesignInput(page, id);
    for (const value of values) {
      if (await toggle.getAttribute('aria-pressed') !== String(Boolean(value))) await toggle.click();
      assert(await toggle.getAttribute('aria-pressed') === String(Boolean(value)), `${id} must accept binary value ${value}`);
    }
  }
});
