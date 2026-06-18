#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

const SIMPLE_VERILOG = `
module nand_gate(input a, input b, output y);
  assign y = ~(a & b);
endmodule
`;

await runIdeGate('IDE import renders schematic contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=import-renders-schematic`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 10000 });

  const startOtherOptions = page.locator('[data-testid="ide-import-start-other-options"]').first();
  if (await visible(startOtherOptions)) {
    const startSecondary = page.locator('[data-testid="ide-import-start-secondary"]').first();
    assert(await visible(startSecondary), 'Import first-look alternatives must expose Paste HDL directly');
    await startSecondary.click();
  } else {
    const startSecondary = page.locator('[data-testid="ide-import-start-secondary"]').first();
    if (await visible(startSecondary)) {
      await startSecondary.click();
    } else {
      await page.locator('[data-testid="ide-import-dock-secondary"]').first().click();
    }
  }

  await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });

  const textarea = page.locator('[data-testid="ide-import-hdl-textarea"]').first();
  assert(await visible(textarea), 'HDL textarea must be visible');
  await textarea.fill(SIMPLE_VERILOG);
  const activeParse = page.locator('[data-testid="ide-import-active-primary"]').first();
  if (await visible(activeParse)) {
    await activeParse.click();
  } else {
    await page.locator('[data-testid="ide-import-parse"]').click();
  }
  await page.waitForTimeout(600);

  const schematic = page.locator('[data-testid="ide-import-schematic-preview"]').first();
  assert(await visible(schematic), 'import schematic preview must render after parse');
});

