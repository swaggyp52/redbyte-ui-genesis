#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design authoring issues contract satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  await page.evaluate(() => {
    const circuitStore = window.__RB_CIRCUIT_STORE__;
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    if (!circuitStore?.setState || !logicStore?.setState) return;

    circuitStore.setState({
      circuit: {
        nodes: [
          {
            id: 'sw0_node',
            type: 'INPUT',
            label: 'SW0',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { isOn: 1 },
          },
          {
            id: 'and0_node',
            type: 'AND',
            position: { x: 100, y: 0 },
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'ld0_node',
            type: 'OUTPUT',
            label: 'LED0',
            position: { x: 210, y: 0 },
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'sw0_node', portName: 'out' },
            to: { nodeId: 'and0_node', portName: 'a' },
          },
        ],
      },
      isDirty: false,
      past: [],
      future: [],
    });

    logicStore.setState({
      selection: { nodes: new Set(), wires: new Set() },
      toolMode: 'select',
      interactionMode: 'idle',
      editingState: { isDragging: false },
    });
  });

  await page.waitForSelector('[data-testid="ide-design-authoring-issues"]', { timeout: 10000 });

  const issueCount = await page.locator('[data-testid^="ide-design-authoring-issue-"]').count();
  assert(issueCount >= 1, `expected at least one compact authoring issue summary, found ${issueCount}`);

  const firstIssueText = (await page.locator('[data-testid="ide-design-authoring-issue-0"]').textContent())?.trim() ?? '';
  assert(firstIssueText.includes('Output not wired yet'), `expected top authoring issue to describe draft output wiring, got ${firstIssueText}`);

  const errorCountText = (await page.locator('[data-testid="ide-design-authoring-issues-errors"]').textContent())?.trim() ?? '';
  const warningCountText = (await page.locator('[data-testid="ide-design-authoring-issues-warnings"]').textContent())?.trim() ?? '';
  const draftCountText = (await page.locator('[data-testid="ide-design-authoring-issues-drafts"]').textContent())?.trim() ?? '';
  assert(errorCountText.includes('0 errors'), `expected non-blocking draft issue to avoid error count, got ${errorCountText}`);
  assert(warningCountText.includes('0 warnings'), `expected no warnings in draft-only authoring state, got ${warningCountText}`);
  assert(draftCountText.includes('2 drafts'), `expected draft count to surface in-progress wiring, got ${draftCountText}`);

  await page.locator('[data-testid="ide-design-authoring-issue-focus-0"]').click();
  await page.waitForSelector('[data-testid="ide-design-selection-inspector"]', { timeout: 10000 });

  const selectedType = (await page.locator('[data-testid="ide-design-selection-type"]').textContent())?.trim();
  assert(selectedType === 'Output', `expected focus action to select Output node, got ${selectedType}`);

  const selectionState = await page.evaluate(() => {
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    if (!logicStore?.getState) return null;
    return Array.from(logicStore.getState().selection?.nodes ?? []);
  });
  assert(Array.isArray(selectionState) && selectionState.includes('ld0_node'), 'focus action must select the affected node');
});
