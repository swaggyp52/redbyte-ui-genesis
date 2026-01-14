import { test } from '@playwright/test';

test('JS health step-by-step truth test', async ({ page }) => {
  test.setTimeout(15000);

  const log = (m: string) => console.log(`[JS-HEALTH] ${m}`);

  log('A: attach listeners');
  page.on('pageerror', (e: Error) => console.log('[JS-HEALTH] PAGEERROR', e?.message || e));
  page.on('console', (msg) => console.log('[JS-HEALTH] CONSOLE', msg.type(), msg.text()));
  page.on('close', () => console.log('[JS-HEALTH] PAGE CLOSED'));
  page.on('crash', () => console.log('[JS-HEALTH] PAGE CRASH'));

  log('B: goto');
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'load', timeout: 10000 });

  log('C: wait 1s');
  await page.waitForTimeout(1000);

  log('D: done');

  // Force page close to break any hanging fixtures
  await page.close();
  log('E: page closed explicitly');
});
