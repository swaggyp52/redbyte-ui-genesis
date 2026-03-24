#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design inspector contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
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

  const hudCount = await page.locator('[data-testid="ide-design-tool-hud"]').count();
  assert(hudCount >= 1, 'design tool HUD marker must exist');

  const paletteCount = await page.locator('[data-testid^="ide-design-palette-"]').count();
  assert(paletteCount >= 8, `expected >=8 design primitives in palette, found ${paletteCount}`);

  await page.locator('[data-testid="ide-design-palette-and"]').click();
  await page.waitForSelector('[data-testid="ide-design-placement-cue"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-design-live-canvas"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.55,
        clientY: rect.top + rect.height * 0.62,
      })
    );
  });
  const andNode = page.locator('[data-testid^="node-AND-"]').first();
  await andNode.waitFor({ timeout: 10000 });
  const andNodeId = await andNode.getAttribute('data-node-id');
  assert(Boolean(andNodeId), 'AND node must expose a data-node-id');
  await page.evaluate((nodeId) => {
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    if (!logicStore?.getState) return;
    logicStore.getState().selectNode(nodeId, false);
  }, andNodeId);
  await page.waitForFunction(
    () => {
      const logicStore = window.__RB_LOGIC_VIEW_STORE__;
      if (!logicStore?.getState) return false;
      return (logicStore.getState().selection?.nodes?.size ?? 0) === 1;
    },
    undefined,
    { timeout: 10000 }
  );

  await page.waitForSelector('[data-testid="ide-design-inspector-identity-title"]', { timeout: 10000 });
  const identityTitle = (await page.locator('[data-testid="ide-design-inspector-identity-title"]').first().textContent())?.trim();
  assert(identityTitle === 'AND gate', `expected AND gate identity title, got ${identityTitle}`);

  const typeText = (await page.locator('[data-testid="ide-design-selection-type"]').first().textContent())?.trim();
  assert(typeText === 'AND gate', `expected AND gate in selection inspector, got ${typeText}`);

  const nodeIdText = (await page.locator('[data-testid="ide-design-selection-id"]').first().textContent())?.trim();
  assert(Boolean(nodeIdText && nodeIdText.length > 0), 'selection inspector must show node id');

  await page.waitForSelector('[data-testid="ide-design-inspector-health"]', { timeout: 10000 });
  const issueTitle = (await page.locator('[data-testid="ide-design-selection-issue-title"]').textContent())?.trim();
  assert(issueTitle === 'Input not wired yet', `expected live issue title in selection inspector, got ${issueTitle}`);

  const actionsText = (await page.locator('[data-testid="ide-design-inspector-actions"]').textContent())?.trim() ?? '';
  assert(actionsText.includes('Rename'), 'primary actions must expose rename');
  assert(actionsText.includes('Trace net'), 'primary actions must expose trace net');

  const propertiesText = (await page.locator('[data-testid="ide-design-inspector-properties"]').textContent())?.trim() ?? '';
  assert(propertiesText.includes('Add label'), 'properties section must surface rename field');
});
