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
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

    await page.waitForSelector('[data-testid="ide-project-readiness-checklist"]', { timeout: 10000 });
    const checklistRows = await page
      .locator('[data-testid="ide-project-readiness-checklist"] tbody tr')
      .count();
    assert(checklistRows === 4, `expected 4 readiness checklist rows, found ${checklistRows}`);

    const bannerVisible = await page
      .locator('[data-testid="ide-project-mapping-banner"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(bannerVisible, 'mapping banner must render in project mode');

    await page.locator('[data-testid="ide-project-auto-suggest"]').click();
    const missingPills = await page
      .locator('[data-testid="ide-project-mapping-table"]')
      .locator('text=Missing')
      .count();
    assert(missingPills === 0, `expected all project mappings resolved after auto-suggest, found ${missingPills} missing`);

    console.log('PASS: IDE project readiness contract satisfied.');
  } catch (error) {
    console.error('FAIL: IDE project readiness contract violated.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
