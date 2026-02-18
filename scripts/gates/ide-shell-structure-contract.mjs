#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const SELECTOR_IDE_ROOT = '[data-testid="ide-root"]';
const SELECTOR_IDE_TOP_BAR = '[data-testid="ide-top-bar"]';
const SELECTOR_IDE_LEFT_RAIL = '[data-testid="ide-left-rail"]';
const SELECTOR_SHELL_ROOT = '[data-testid="desktop-shell"]';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectVisible(page, selector, timeout = 15000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

async function expectModeMarker(page, mode) {
  const selector = `[data-testid="ide-mode-${mode}"]`;
  await expectVisible(page, selector);
  const marker = await page.locator(selector).first().getAttribute('data-ide-mode-marker');
  assert(marker === mode, `expected data-ide-mode-marker=${mode}, received ${marker}`);
}

async function verifyShellStructure(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

  await expectVisible(page, SELECTOR_IDE_ROOT);
  await expectVisible(page, SELECTOR_IDE_TOP_BAR);
  await expectVisible(page, SELECTOR_IDE_LEFT_RAIL);

  const shellCount = await page.locator(SELECTOR_SHELL_ROOT).count();
  assert(shellCount === 0, 'shell container must not mount on default IDE route');

  await expectModeMarker(page, 'project');

  await page.locator('[data-testid="mode-button-design"]').click();
  await expectModeMarker(page, 'design');
  await expectVisible(page, SELECTOR_IDE_TOP_BAR);
  await expectVisible(page, SELECTOR_IDE_LEFT_RAIL);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await expectModeMarker(page, 'verify');
  await expectVisible(page, SELECTOR_IDE_TOP_BAR);
  await expectVisible(page, SELECTOR_IDE_LEFT_RAIL);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  let exitCode = 0;

  try {
    await verifyShellStructure(page);
    console.log('PASS: IDE shell structure contract satisfied.');
  } catch (error) {
    exitCode = 1;
    console.error('FAIL: IDE shell structure contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
    await browser.close();
  }

  process.exit(exitCode);
}

main();
