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

    await page.locator('[data-testid="mode-button-export"]').click();
    await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });

    const downloadAllVisible = await page
      .locator('[data-testid="ide-export-download-all"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(downloadAllVisible, 'download-all export action must be visible');

    const readmePreviewVisible = await page
      .locator('[data-testid="ide-export-readme-preview"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(readmePreviewVisible, 'README preview section must be visible');

    const vivadoChecklistVisible = await page
      .locator('[data-testid="ide-export-vivado-checklist"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(vivadoChecklistVisible, 'Vivado checklist must be visible');

    console.log('PASS: IDE export download contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE export download contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
