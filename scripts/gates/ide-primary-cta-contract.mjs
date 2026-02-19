#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const MODES = ['project', 'design', 'verify', 'export', 'import'];

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

    for (const mode of MODES) {
      await page.locator(`[data-testid="mode-button-${mode}"]`).click();
      await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 10000 });

      const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
      const ctaLocator = modeRoot.locator('[data-testid="ide-primary-cta"]');
      const count = await ctaLocator.count();
      assert(count === 1, `mode=${mode} expected exactly one ide-primary-cta, found ${count}`);

      const visible = await ctaLocator.first().isVisible().catch(() => false);
      assert(visible, `mode=${mode} ide-primary-cta must be visible`);
    }

    console.log('PASS: IDE primary CTA contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE primary CTA contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
