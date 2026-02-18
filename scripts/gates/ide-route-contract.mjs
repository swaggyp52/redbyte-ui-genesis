#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const SELECTOR_IDE_ROOT = '[data-testid="ide-root"]';
const SELECTOR_IDE_LEFT_RAIL = '[data-testid="ide-left-rail"]';
const SELECTOR_SHELL_ROOT = '[data-testid="desktop-shell"]';

async function isVisible(page, selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function count(page, selector) {
  return page.locator(selector).count();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyDefaultIdeRoute(page) {
  const consoleLines = [];
  page.on('console', (message) => {
    consoleLines.push(message.text());
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

  await page.waitForSelector(SELECTOR_IDE_ROOT, { state: 'visible', timeout: 15000 });
  await page.waitForSelector(SELECTOR_IDE_LEFT_RAIL, { state: 'visible', timeout: 15000 });

  const mode = await page.evaluate(() => document.documentElement.getAttribute('data-redbyte-mode'));
  assert(mode === 'ide', `expected data-redbyte-mode=\"ide\", received \"${mode}\"`);

  const shellCount = await count(page, SELECTOR_SHELL_ROOT);
  const shellVisible = await isVisible(page, SELECTOR_SHELL_ROOT);
  assert(shellCount === 0 && !shellVisible, 'shell container must not mount on /');

  const ideBootLog = consoleLines.find(
    (line) =>
      line.includes('[RB_BOOT] mode=IDE') &&
      line.includes('entry=ide-bootstrap.ts') &&
      line.includes('config=vite.config.ts')
  );
  assert(Boolean(ideBootLog), 'missing IDE boot proof log with config=vite.config.ts');
}

async function verifyLauncherRoute(page) {
  await page.goto(`${BASE_URL}/?launcher=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector(SELECTOR_SHELL_ROOT, { state: 'visible', timeout: 15000 });

  const ideCount = await count(page, SELECTOR_IDE_ROOT);
  const ideVisible = await isVisible(page, SELECTOR_IDE_ROOT);
  assert(ideCount === 0 && !ideVisible, 'IDE markers must be absent in launcher mode');
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  let exitCode = 0;

  try {
    await verifyDefaultIdeRoute(page);
    await verifyLauncherRoute(page);
    console.log('PASS: IDE route contract satisfied.');
  } catch (error) {
    exitCode = 1;
    console.error('FAIL: IDE route contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
    await browser.close();
  }

  process.exit(exitCode);
}

main();
