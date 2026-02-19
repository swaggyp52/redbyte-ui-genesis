#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
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
    await page.waitForSelector('[data-testid="ide-design-tool-hud"]', { timeout: 10000 });

    const paletteCount = await page.locator('[data-testid^="ide-design-palette-"]').count();
    assert(paletteCount === 8, `expected 8 design primitives in palette, found ${paletteCount}`);

    await page.locator('[data-testid="ide-design-add-and-starter"]').click();
    const andNode = page.locator('[data-testid^="node-AND-"]').first();
    await andNode.waitFor({ timeout: 10000 });
    await andNode.click();

    await page.waitForSelector('[data-testid="ide-design-selection-inspector"]', { timeout: 10000 });
    const typeText = (await page.locator('[data-testid="ide-design-selection-type"]').textContent())?.trim();
    assert(typeText === 'AND', `expected AND in selection inspector, got ${typeText}`);

    const nodeIdText = (await page.locator('[data-testid="ide-design-selection-id"]').textContent())?.trim();
    assert(Boolean(nodeIdText && nodeIdText.length > 0), 'selection inspector must show node id');

    const pinCount = await page.locator('[data-testid="ide-design-selection-pins"] .ide-design-pin-pill').count();
    assert(pinCount >= 3, `expected at least 3 pin pills for AND node, found ${pinCount}`);

    console.log('PASS: IDE design inspector contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE design inspector contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
