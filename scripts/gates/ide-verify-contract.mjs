#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE verify contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-banner"]', { timeout: 10000 });

  const addVectorFormVisible = await page
    .locator('[data-testid="ide-verify-add-vector-form"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(addVectorFormVisible, 'verify add-vector form must render');

  const autoInputFieldCount = await page.locator('[data-testid^="ide-verify-add-vector-input-"]').count();
  assert(autoInputFieldCount >= 1, 'verify add-vector form must include auto-generated input fields');

  const vectorRowsBefore = await page
    .locator('[data-testid="ide-verify-vectors-table"] tbody tr')
    .filter({ has: page.locator('code') })
    .count();
  await page.locator('[data-testid="ide-verify-add-vector-tick"]').fill('42');
  await page.locator('[data-testid^="ide-verify-add-vector-input-"]').first().selectOption('1');
  await page.locator('[data-testid="ide-verify-add-vector-submit"]').click();
  const vectorRowsAfter = await page
    .locator('[data-testid="ide-verify-vectors-table"] tbody tr')
    .filter({ has: page.locator('code') })
    .count();
  assert(vectorRowsAfter > vectorRowsBefore, 'adding a vector must increase vector table rows');

  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  const vectorRowsWithBasics = await page
    .locator('[data-testid="ide-verify-vectors-table"] tbody tr')
    .filter({ has: page.locator('code') })
    .count();
  assert(vectorRowsWithBasics >= 3, 'generate basics must add at least 3 vector rows');

  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(label && !/IDLE/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );

  const consoleHashText = (
    await page.locator('[data-testid="ide-verify-console-hash"]').first().textContent().catch(() => '')
  )?.trim();
  assert(Boolean(consoleHashText && consoleHashText.includes('report=')), 'verify console hash must be visible after run');
  assert(!consoleHashText.includes('report=—'), 'verify report hash must be materialized after run');

  const statusText = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim();
  assert(
    /PASS|FAIL|TRACE|READY/i.test(statusText || ''),
    `verify summary status should be populated after run, got "${statusText}"`
  );
});

