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

await runIdeGate('IDE live simulation contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.locator('[data-testid="ide-project-load-start-logic-gates"]').click();

  const replaceModalVisible = await page
    .locator('[data-testid="ide-example-confirm-modal"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (replaceModalVisible) {
    await page.locator('[data-testid="ide-example-confirm"]').click();
  }

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-live-signals"]', { timeout: 10000 });

  const inputIds = await page.$$eval('[data-testid^="ide-design-live-input-"]', (rows) =>
    rows
      .map((entry) => (entry.getAttribute('data-testid') || '').replace('ide-design-live-input-', ''))
      .filter(Boolean)
  );
  assert(inputIds.length >= 2, `expected at least 2 live inputs, found ${inputIds.length}`);

  const toggleIds = await page.$$eval(
    '[data-testid^="switch-toggle-"]:not([data-testid$="-container"])',
    (rows) =>
      rows
        .map((entry) => (entry.getAttribute('data-testid') || '').replace('switch-toggle-', ''))
        .filter(Boolean)
  );

  const simInputIds = inputIds.filter((entry) => toggleIds.includes(entry)).slice(0, 2);
  assert(simInputIds.length === 2, 'expected two toggleable inputs in Design mode');

  const widgetLabels = await page.$$eval(
    '[data-testid^="switch-toggle-"][data-testid$="-container"] text',
    (labels) => labels.map((node) => (node.textContent || '').trim().toUpperCase()).filter(Boolean)
  );
  assert(
    widgetLabels.some((label) => label.includes('SW0') || label.includes('SW1')),
    'Basys-style switch labels should be visible for AND starter inputs'
  );

  await setBinaryInput(page, simInputIds[0], 1);
  await setBinaryInput(page, simInputIds[1], 1);

  const outputRow = page.locator('[data-testid^="ide-design-live-output-"]').first();
  await outputRow.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(
    () => {
      const row = document.querySelector('[data-testid^="ide-design-live-output-"] code');
      if (!row) return false;
      return (row.textContent || '').trim() === '1';
    },
    { timeout: 10000 }
  );

  const tickBefore = Number.parseInt(
    (await text(page.locator('[data-testid="ide-design-sim-tick"]'))) || '0',
    10
  );
  await page.locator('[data-testid="ide-design-sim-step"]').click();
  await page.waitForFunction(
    (before) => {
      const node = document.querySelector('[data-testid="ide-design-sim-tick"]');
      if (!node) return false;
      const tick = Number.parseInt((node.textContent || '0').trim(), 10);
      return Number.isFinite(tick) && tick > before;
    },
    tickBefore,
    { timeout: 10000 }
  );

  const outputAfterStep = await text(page.locator('[data-testid^="ide-design-live-output-"] code').first());
  assert(outputAfterStep === '1', `expected combinational output to stay high after step, got ${outputAfterStep}`);
});

