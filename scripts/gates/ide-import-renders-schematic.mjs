#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

const SIMPLE_VERILOG = `
module nand_gate(input a, input b, output y);
  assign y = ~(a & b);
endmodule
`;

await runIdeGate('IDE import renders schematic contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-import"]').click();
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-import-card-hdl"]').click();
  await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });

  const textarea = page.locator('[data-testid="ide-import-hdl-textarea"]').first();
  assert(await visible(textarea), 'HDL textarea must be visible');
  await textarea.fill(SIMPLE_VERILOG);
  await page.locator('[data-testid="ide-import-parse"]').click();
  await page.waitForTimeout(600);

  const schematic = page.locator('[data-testid="ide-import-schematic-preview"]').first();
  const diagnosticsPanel = page.locator('[data-testid="ide-import-diagnostics-panel"]').first();
  assert(await visible(diagnosticsPanel), 'import diagnostics panel must be visible');
  assert(await visible(schematic), 'import schematic preview must render after parse');
});

