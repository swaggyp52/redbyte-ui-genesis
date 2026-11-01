#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE shell density contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const topBar = page.locator('[data-testid="ide-top-bar"]').first();
  const leftRail = page.locator('[data-testid="ide-workspace-rail"]').first();

  assert(await visible(topBar), 'top bar must be visible');
  assert(await visible(leftRail), 'left rail must be visible');
  const consoleCount = await page.locator('[data-testid="ide-workbench-console"]').count();

  const [topBarBox, leftRailBox] = await Promise.all([
    topBar.boundingBox(),
    leftRail.boundingBox(),
  ]);

  assert(Boolean(topBarBox), 'top bar bounding box unavailable');
  assert(Boolean(leftRailBox), 'left rail bounding box unavailable');

  assert(topBarBox.height <= 52, `top bar must stay dense (<=52px), got ${topBarBox.height}`);
  // The rail follows its one declared width (--wb-rail-w, 4rem) and stays dense: it may not grow
  // past 80px at the default 16px text, which is what the Studio restart had given it.
  const declaredRailWidth = await page.evaluate(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--wb-rail-w').trim();
    if (!raw) return null;
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;width:${raw}`;
    document.body.appendChild(probe);
    const measured = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(measured * 100) / 100;
  });
  assert(declaredRailWidth !== null, '--wb-rail-w is not declared, so the rail has no owner');
  assert(
    Math.abs(leftRailBox.width - declaredRailWidth) <= 1,
    `left rail must follow the declared --wb-rail-w (${declaredRailWidth}px), got ${leftRailBox.width}`
  );
  // Bounded both ways, as the literal 80px was: the owner's 56-64px range at the low end, the
  // Studio restart's 80px at the high end. Following the token alone cannot fail, because the
  // rail's grid track is sized by that same token.
  assert(
    leftRailBox.width >= 56 && leftRailBox.width <= 80,
    `left rail must stay dense and keep its labels (56-80px at 16px text), got ${leftRailBox.width}`
  );
  // Every workspace label stays whole inside its rail button: a narrower rail would cut
  // "Simulate" and "Package" while the width check alone still passed.
  const cutLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="ide-workspace-rail"] .wb-rail-btn > span:not(.wb-rail-dot)'))
      .map((label) => {
        const button = label.closest('.wb-rail-btn');
        const labelBox = label.getBoundingClientRect();
        const buttonBox = button?.getBoundingClientRect();
        const cut = label.scrollWidth > label.clientWidth + 1 ||
          (buttonBox ? labelBox.left < buttonBox.left - 0.5 || labelBox.right > buttonBox.right + 0.5 : false);
        return cut ? `${(label.textContent || '').trim()} (${Math.round(label.scrollWidth)}px in ${Math.round(buttonBox?.width ?? 0)}px)` : null;
      })
      .filter(Boolean)
  );
  assert(cutLabels.length === 0, `rail labels must fit their buttons, cut: ${cutLabels.join(', ')}`);

  if (consoleCount > 0) {
    const consolePanel = page.locator('[data-testid="ide-workbench-console"]').first();
    const consoleStateAttr = await consolePanel.getAttribute('data-console-state');
    const consoleClass = await consolePanel.getAttribute('class');
    const consoleState =
      consoleStateAttr ??
      (consoleClass?.includes('is-collapsed') ? 'collapsed' : consoleClass?.includes('is-expanded') ? 'expanded' : null);
    assert(
      consoleState === 'collapsed',
      `console should default to collapsed when empty, got state="${consoleState ?? ''}"`
    );
  }
});
