#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE lab4 load fast contract satisfied', async ({ page, baseUrl }) => {
  const start = Date.now();
  await page.goto(`${baseUrl}/?labId=lab-04`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 10000 });
  const elapsed = Date.now() - start;
  assert(elapsed <= 10000, `Lab 4 took ${(elapsed / 1000).toFixed(2)}s to load (threshold 10s)`);
});

