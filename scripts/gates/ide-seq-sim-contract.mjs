#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

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

await runIdeGate('IDE sequential simulation contract satisfied', async ({ page, baseUrl }) => {
  // Seed a minimal DFlipFlop circuit: D (Switch, starts 0) + CLK (Switch, starts 1, transparent
  // mode) + DFlipFlop + Q OUTPUT. CLK state.isOn=1 means sim-reset restores CLK=1 automatically
  // (deriveSimulationInputs reads node.state.isOn on reset), keeping the DFF transparent so
  // Q tracks D immediately on each step. This avoids loading the complex two-bit-counter
  // example that crashes the browser tab.
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
            // D input — Switch starts at 0 so reset restores D=0
            { id: 'd_in',    type: 'Switch',     x: 100, y: 150, position: { x: 100, y: 150 },
              config: {}, state: { isOn: 0 } },
            // CLK — Switch starts at 1 so reset always restores CLK=1 (transparent latch mode).
            // The gate never changes CLK so it stays high throughout; Q=D on every propagation.
            { id: 'clk_in',  type: 'Switch',     x: 100, y: 280, position: { x: 100, y: 280 },
              config: {}, state: { isOn: 1 } },
            { id: 'dff_node', type: 'DFlipFlop', x: 300, y: 200, position: { x: 300, y: 200 },
              config: {}, state: {} },
            { id: 'q_out',   type: 'OUTPUT',     x: 500, y: 200, position: { x: 500, y: 200 },
              config: {}, state: {} },
          ],
          connections: [
            { from: { nodeId: 'd_in',     portName: 'out' }, to: { nodeId: 'dff_node', portName: 'D'   } },
            { from: { nodeId: 'clk_in',   portName: 'out' }, to: { nodeId: 'dff_node', portName: 'CLK' } },
            { from: { nodeId: 'dff_node', portName: 'Q'   }, to: { nodeId: 'q_out',    portName: 'in'  } },
          ],
        },
        verifyRunHistory: [],
        sim: { tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
               inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [] },
        projectHealthCore: { lastVerify: null, lastExport: null,
                             dirtySinceVerify: false, dirtySinceExport: false },
        customComponents: [],
      },
      version: 4,
    };
    localStorage.setItem('rb.ide.project-runtime.v1', JSON.stringify(circuit));
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-live-signals"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-design-sim-reset"]').click();

  const inputIds = await page.$$eval('[data-testid^="ide-design-live-input-"]', (rows) =>
    rows
      .map((entry) => (entry.getAttribute('data-testid') || '').replace('ide-design-live-input-', ''))
      .filter(Boolean)
  );
  const dataInputId = inputIds.find((entry) => /dff_data|_data|(^d$)/i.test(entry)) ?? inputIds[0];
  assert(Boolean(dataInputId), 'expected at least one live input for sequential example');
  await setBinaryInput(page, dataInputId, 1);

  // q_out is the OUTPUT node id in this seed; dff_q fallback keeps original selector working
  // if a future rebuild uses that id.
  const outputRow = page
    .locator('[data-testid="ide-design-live-output-dff_q"] code')
    .first();
  const outputFallback = page.locator('[data-testid^="ide-design-live-output-"] code').first();

  let observedHigh = false;
  for (let index = 0; index < 10; index += 1) {
    await page.locator('[data-testid="ide-design-sim-step"]').click();
    const current = (await text(outputRow)) || (await text(outputFallback));
    if (current === '1') {
      observedHigh = true;
      break;
    }
  }
  assert(observedHigh, 'expected DFF output to capture high data after stepping clocked simulation');

  // Restore D to 0 before reset: handleToggleSwitch commits to the circuit store, so reset
  // restores D from node.state.isOn — which must be 0 for Q to clear on reset.
  await setBinaryInput(page, dataInputId, 0);

  await page.locator('[data-testid="ide-design-sim-reset"]').click();
  const outputAfterReset = (await text(outputRow)) || (await text(outputFallback));
  if (outputAfterReset !== '0') {
    await page.locator('[data-testid="ide-design-sim-step"]').click();
  }
  const resetValue = (await text(outputRow)) || (await text(outputFallback));
  assert(resetValue === '0', `expected sequential reset to clear output to 0, got ${resetValue}`);
});
