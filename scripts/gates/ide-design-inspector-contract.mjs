#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design inspector contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (store?.getState) {
      store.getState().reset();
    }
  });

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  assert(await visible(page.getByTestId('ide-design-toolbar')), 'current design toolbar must be visible');
  assert(await visible(page.getByTestId('ide-design-tool-segmented')), 'current Select/Wire controls must be visible');

  if (!(await page.locator('[data-testid="ide-design-palette-and"]').first().isVisible().catch(() => false))) {
    const paletteRail = page.locator('[data-testid="ide-show-left-dock"]').first();
    if (await paletteRail.isVisible().catch(() => false)) {
      await paletteRail.click();
    }
  }
  await page.getByTestId('ide-design-left-tab-components').click();
  await page.waitForSelector('[data-testid="ide-design-palette-and"]', { timeout: 10000 });

  const paletteCount = await page.locator('[data-testid^="ide-design-palette-"]').count();
  assert(paletteCount >= 8, `expected >=8 design primitives in palette, found ${paletteCount}`);

  await page.locator('[data-testid="ide-design-palette-and"]').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1');
  const canvasBox = await page.getByTestId('ide-design-live-canvas').boundingBox();
  assert(canvasBox, 'AND placement requires measurable canvas bounds');
  await page.mouse.click(canvasBox.x + canvasBox.width * .55, canvasBox.y + canvasBox.height * .62);
  const andNode = page.locator('[data-testid^="node-AND-"]').first();
  await andNode.waitFor({ timeout: 10000 });
  const andNodeId = await andNode.getAttribute('data-node-id');
  assert(Boolean(andNodeId), 'AND node must expose a data-node-id');
  await page.getByTestId('ide-design-tool-select').click();
  // Insertion selects its new part. Deselect through real canvas interaction
  // before proving selection of the painted AND body; group bounds also include
  // pin stubs, labels and unpainted space.
  const currentCanvas = page.getByTestId('ide-design-live-canvas');
  const selectionCanvasBox = await currentCanvas.boundingBox();
  assert(selectionCanvasBox, 'canvas must remain measurable after placing AND');
  await currentCanvas.click({ position: { x: selectionCanvasBox.width * .12, y: selectionCanvasBox.height * .18 } });
  await page.waitForFunction(() => (window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes?.size ?? -1) === 0,
    undefined, { timeout: 10000 });
  const paintedBody = andNode.locator('.rb-sym-body');
  await paintedBody.waitFor({ state: 'visible' });
  await paintedBody.click();
  await page.waitForFunction(
    (expectedNodeId) => {
      const selected = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes;
      return selected?.size === 1 && selected.has(expectedNodeId);
    },
    andNodeId,
    { timeout: 10000 }
  );
  assert(await andNode.getAttribute('data-node-selected') === '1',
    'painted AND selection marker must agree with canonical selection');

  // The current Design inspector is contextual and can start compact.
  // Reveal its real dock and choose Inspector before inspecting its subject.
  const revealInspector = page.getByTestId('ide-show-right-dock');
  if (await visible(revealInspector)) await revealInspector.click();
  await page.getByTestId('ide-right-dock').waitFor({ state: 'visible', timeout: 10000 });
  const inspectorTab = page.getByTestId('ide-design-right-tab-inspector');
  await inspectorTab.waitFor({ state: 'visible' });
  if (await inspectorTab.getAttribute('aria-selected') !== 'true') await inspectorTab.click();
  assert(await inspectorTab.getAttribute('aria-selected') === 'true', 'Inspector tab must own selected part details');
  await page.waitForFunction((expectedNodeId) => {
    const selected = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes;
    return selected?.size === 1 && selected.has(expectedNodeId);
  }, andNodeId, { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-inspector-identity-title"]', { state: 'visible', timeout: 10000 });
  const identityTitle = (await page.locator('[data-testid="ide-design-inspector-identity-title"]').first().textContent())?.trim();
  assert(identityTitle === 'AND gate', `expected AND gate identity title, got ${identityTitle}`);

  const typeText = (await page.locator('[data-testid="ide-design-selection-type"]').first().textContent())?.trim();
  assert(typeText === 'AND gate', `expected AND gate in selection inspector, got ${typeText}`);

  const nodeIdText = (await page.locator('[data-testid="ide-design-selection-id"]').first().textContent())?.trim();
  assert(Boolean(nodeIdText && nodeIdText.length > 0), 'selection inspector must show node id');

  await page.waitForSelector('[data-testid="ide-design-selection-issues"]', { timeout: 10000 });
  const issueTitle = (await page.locator('[data-testid="ide-design-selection-issue-title"]').textContent())?.trim();
  assert(issueTitle === 'Input not wired yet', `expected live issue title in selection inspector, got ${issueTitle}`);

  const actionsText = (await page.locator('[data-testid="ide-design-inspector-actions"]').textContent())?.trim() ?? '';
  assert(actionsText.includes('Copy'), 'primary actions must expose copy');
  assert(actionsText.includes('Duplicate'), 'primary actions must expose duplicate');
  assert(actionsText.includes('Trace net'), 'primary actions must expose trace net');
  // Keep these as reachable controls, beyond hidden/offscreen section text.
  for (const name of ['Copy', 'Duplicate', 'Trace net']) {
    const action = page.getByTestId('ide-design-inspector-actions').getByRole('button', { name, exact: true });
    await action.scrollIntoViewIfNeeded();
    assert(await action.isVisible(), name + ' must be visibly reachable in Inspector');
    if (name === 'Trace net') {
      assert(await action.isDisabled(), 'Trace net must remain disabled until the selected node has fanout');
    } else {
      assert(await action.isEnabled(), name + ' must be available for the selected AND');
    }
  }

  const labelEditText = (await page.locator('[data-testid="ide-design-label-edit-btn"]').textContent())?.trim() ?? '';
  assert(labelEditText.includes('Add label'), `label editor must surface Add label, got ${labelEditText}`);
});
