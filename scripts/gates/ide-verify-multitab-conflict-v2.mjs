#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE Verify multi-tab conflict V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-multitab-conflict-v2-primary`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });

  const second = await page.context().newPage();
  try {
    await second.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-multitab-conflict-v2-second`, {
      waitUntil: 'domcontentloaded',
    });
    await second.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await second.evaluate(() => {
      const key = 'rb.ide.project-runtime.v1';
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : { state: {} };
      parsed.state = {
        ...(parsed.state ?? {}),
        projectName: 'Phase 3F Other Tab Edit',
        lastSavedAt: 'Saved from another tab',
      };
      localStorage.setItem(key, JSON.stringify(parsed));
    });
  } finally {
    await second.close().catch(() => null);
  }

  const banner = page.locator('[data-testid="ide-storage-conflict-banner"]').first();
  await banner.waitFor({ state: 'visible', timeout: 10000 });
  const bannerText = await banner.innerText();
  assert(/Saved work changed elsewhere/i.test(bannerText), `conflict banner must name changed saved work, got "${bannerText}"`);
  assert(/Reload to review/i.test(bannerText), `conflict banner must include reload guidance, got "${bannerText}"`);
  assert(/Phase 3F Other Tab Edit/i.test(bannerText), `conflict banner must include external project label, got "${bannerText}"`);
  assert(await visible(banner.locator('button', { hasText: 'Reload' }).first()), 'conflict banner must expose Reload');
  assert(await visible(banner.locator('button', { hasText: 'Dismiss' }).first()), 'conflict banner must expose Dismiss');

  await banner.locator('button', { hasText: 'Dismiss' }).first().click();
  assert(
    !(await banner.isVisible().catch(() => false)),
    'Dismiss must clear the multi-tab conflict banner without changing mode'
  );
  assert(await visible(page.locator('[data-testid="ide-mode-verify"]').first()), 'Verify mode must remain visible after dismissing conflict banner');

  assert(
    findings.length === 0,
    `multi-tab conflict gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

function captureBrowserProblems(page) {
  const findings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      findings.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));
  return findings;
}
