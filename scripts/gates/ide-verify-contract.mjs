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

    await page.locator('[data-testid="mode-button-verify"]').click();
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ide-verify-banner"]', { timeout: 10000 });

    await page.locator('[data-testid="ide-verify-vector-fail"]').click();
    await page.locator('[data-testid="ide-verify-run"]').click();
    await page.waitForFunction(
      () => {
        const label = document.querySelector('[data-testid="ide-verify-status-label"]');
        return Boolean(label && /FAIL/i.test(label.textContent || ''));
      },
      { timeout: 10000 }
    );

    const diffVisible = await page
      .locator('[data-testid="ide-verify-diff-table"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(diffVisible, 'verify diff table must render in FAIL state');

    const firstFailTickVisible = await page
      .locator('[data-testid="ide-verify-first-fail-tick"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(firstFailTickVisible, 'first failing tick must render in FAIL state');

    await page.locator('[data-testid="ide-verify-vector-pass"]').click();
    await page.locator('[data-testid="ide-verify-run"]').click();
    await page.waitForFunction(
      () => {
        const label = document.querySelector('[data-testid="ide-verify-status-label"]');
        return Boolean(label && /PASS/i.test(label.textContent || ''));
      },
      { timeout: 10000 }
    );

    const hashText = (
      await page.locator('[data-testid="ide-verify-hash"]').first().textContent().catch(() => '')
    )?.trim();
    assert(Boolean(hashText && hashText.length > 0), 'verify hash must be visible when PASS');

    const exportDisabled = await page
      .locator('[data-testid="ide-verify-export-testbench"]')
      .first()
      .isDisabled();
    assert(!exportDisabled, 'export testbench button must be enabled after PASS');

    console.log('PASS: IDE verify contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE verify contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
