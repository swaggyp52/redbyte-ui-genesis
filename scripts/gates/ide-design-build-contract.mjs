#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design build contract satisfied', async ({ page, baseUrl }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-build-contract`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ide-mode-project').waitFor({ timeout: 15000 });
  await page.getByTestId('ide-project-build-fresh-primary').click();
  await page.getByTestId('ide-mode-design').waitFor({ timeout: 15000 });
  const canvas = page.getByTestId('ide-design-live-canvas');
  const toolbar = page.getByTestId('ide-design-toolbar');
  await canvas.waitFor({ state: 'visible' });
  assert(await visible(toolbar), 'current design toolbar must be visible');
  assert(await visible(page.getByTestId('ide-design-tool-segmented')), 'Select/Wire tool group must be visible');
  assert(await visible(page.getByTestId('ide-design-empty-state')), 'blank circuit must show direct authoring guidance');
  for (const id of ['ide-design-empty-add-input', 'ide-design-empty-add-output', 'ide-design-empty-place-gate']) {
    assert(await visible(page.getByTestId(id)), `blank circuit must expose ${id}`);
  }
  for (const id of ['ide-design-fit-circuit-canvas', 'ide-design-zoom-out', 'ide-design-zoom-in',
    'ide-design-zoom-readout', 'ide-design-tool-undo', 'ide-design-tool-redo']) {
    const control = toolbar.getByTestId(id);
    assert(await visible(control), `${id} must remain directly available in the toolbar`);
    assert(await control.evaluate(element => !element.closest('details')), `${id} must not require a disclosure`);
  }
  assert(await page.getByTestId('ide-design-tools-toggle').count() === 0, 'removed secondary Tools disclosure must not return');
  const initialZoom = await page.getByTestId('ide-design-canvas-stat-zoom').innerText();
  assert((await circuit(page)).nodes.length === 0 && (await circuit(page)).connections.length === 0,
    'Build Fresh must start a genuinely empty circuit');

  await page.getByTestId('ide-design-tool-wire').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'wire');
  assert(/wire|pin/i.test(await page.getByTestId('ide-design-wire-cue').first().innerText()), 'wire cue must describe wiring or pins');
  await page.getByTestId('ide-design-tool-select').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'select');

  const a = await place(page, 'ide-design-empty-add-input', .25, .3, 'INPUT');
  const reveal = page.getByTestId('ide-show-left-dock');
  if (await visible(reveal)) await reveal.click();
  await page.getByTestId('ide-design-left-tab-components').click();
  const b = await place(page, 'ide-design-palette-input', .25, .7, 'INPUT');
  const gate = await place(page, 'ide-design-palette-and', .5, .5, 'AND');
  const output = await place(page, 'ide-design-palette-output', .78, .5, 'OUTPUT');
  assert((await circuit(page)).nodes.length === 4, 'current blank authoring must place exactly two INPUTs, AND and OUTPUT');

  await page.getByTestId('ide-design-fit-circuit-canvas').click();
  await page.getByTestId('ide-design-tool-wire').click();
  for (const [fromId, fromPort, toId, toPort] of [[a, 'out', gate, 'a'], [b, 'out', gate, 'b'], [gate, 'out', output, 'in']]) {
    const before = (await circuit(page)).connections.length;
    await page.locator(`[data-node-id="${fromId}"] [data-port-id="${fromPort}"]`).first().click();
    await page.locator(`[data-node-id="${toId}"] [data-port-id="${toPort}"]`).first().click();
    await page.waitForFunction(count => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit.connections.length === count, before + 1);
  }
  const wired = await circuit(page);
  assert(wired.connections.length === 3, 'all required AND ports must receive canonical visible authored wires');
  assert(wired.connections.every(wire => wire.from?.nodeId && wire.from?.portName && wire.to?.nodeId && wire.to?.portName),
    'authored wires must use canonical endpoints');

  await page.getByTestId('ide-design-tool-select').click();
  // Select through actual node bodies; a shift-click must extend the selection.
  await page.locator(`[data-node-id="${a}"]`).first().click({ position: { x: 12, y: 8 } });
  await page.locator(`[data-node-id="${b}"]`).first().click({ position: { x: 12, y: 8 }, modifiers: ['Shift'] });
  await page.waitForFunction(({a,b}) => {
    const selected = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes;
    return selected?.size === 2 && selected.has(a) && selected.has(b);
  }, {a,b});
  await page.keyboard.press('Delete');
  await page.waitForFunction(({a,b}) => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit.nodes ?? [];
    return nodes.length === 2 && !nodes.some(node => node.id === a || node.id === b);
  }, {a,b});
  const final = await circuit(page);
  assert(final.connections.length === 1, 'Delete must remove exactly the wires incident to deleted inputs');
  const updatedZoom = await page.getByTestId('ide-design-canvas-stat-zoom').innerText();
  assert(initialZoom.includes('%') && updatedZoom.includes('%'), 'zoom readback must remain a percentage');
  const camera = await page.evaluate(() => window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera);
  assert(camera && [camera.x, camera.y, camera.zoom].every(Number.isFinite) && camera.zoom > 0, 'camera must remain finite after authoring/deletion');
  assert(await page.getByTestId('rb-ide-boot-crash').count() === 0, 'no crash during Design authoring');
  assert(pageErrors.length === 0, `page errors detected: ${pageErrors.join(' | ')}`);
});

async function circuit(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ?? { nodes: [], connections: [] });
}
async function place(page, testId, x, y, type) {
  const before = (await circuit(page)).nodes.map(node => node.id);
  await page.getByTestId(testId).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1');
  const canvas = page.getByTestId('ide-design-live-canvas');
  const box = await canvas.boundingBox();
  assert(box, `${testId}: canvas must have measurable bounds`);
  await page.mouse.click(box.x + box.width*x, box.y + box.height*y);
  await page.waitForFunction(ids => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit.nodes ?? [];
    return nodes.length === ids.length+1 && nodes.some(node => !ids.includes(node.id));
  }, before);
  const added = (await circuit(page)).nodes.filter(node => !before.includes(node.id));
  assert(added.length === 1 && added[0].type === type, `${testId}: real canvas placement must add one ${type}`);
  return added[0].id;
}
