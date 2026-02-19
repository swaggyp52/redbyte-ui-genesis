#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const MODES = ['project', 'design', 'verify', 'export', 'import'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function visible(locator) {
  return locator.first().isVisible().catch(() => false);
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

      const marker = await modeRoot.getAttribute('data-ide-mode-marker');
      assert(marker === mode, `mode marker mismatch for ${mode}: ${marker}`);

      const hasGrid = await visible(modeRoot.locator('[data-testid="ide-surface-grid"]'));
      const hasHeader = await visible(modeRoot.locator('[data-testid="ide-surface-header"]'));
      const hasTitle = await visible(modeRoot.locator('[data-testid="ide-surface-title"]'));
      const hasActions = await visible(modeRoot.locator('[data-testid="ide-surface-actions"]'));

      assert(hasGrid, `mode=${mode} missing ide-surface-grid`);
      assert(hasHeader, `mode=${mode} missing ide-surface-header`);
      assert(hasTitle, `mode=${mode} missing ide-surface-title`);
      assert(hasActions, `mode=${mode} missing ide-surface-actions`);
    }

    console.log('PASS: IDE visual contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE visual contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
