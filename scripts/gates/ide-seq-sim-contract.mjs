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
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.locator('[data-testid="ide-open-example-dff-toggle"]').click();

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

  await page.locator('[data-testid="ide-design-sim-reset"]').click();

  const inputIds = await page.$$eval('[data-testid^="ide-design-live-input-"]', (rows) =>
    rows
      .map((entry) => (entry.getAttribute('data-testid') || '').replace('ide-design-live-input-', ''))
      .filter(Boolean)
  );
  const dataInputId = inputIds.find((entry) => /dff_data|_data|(^d$)/i.test(entry)) ?? inputIds[0];
  assert(Boolean(dataInputId), 'expected at least one live input for sequential example');
  await setBinaryInput(page, dataInputId, 1);

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

  await page.locator('[data-testid="ide-design-sim-reset"]').click();
  const outputAfterReset = (await text(outputRow)) || (await text(outputFallback));
  if (outputAfterReset !== '0') {
    await page.locator('[data-testid="ide-design-sim-step"]').click();
  }
  const resetValue = (await text(outputRow)) || (await text(outputFallback));
  assert(resetValue === '0', `expected sequential reset to clear output to 0, got ${resetValue}`);
});
