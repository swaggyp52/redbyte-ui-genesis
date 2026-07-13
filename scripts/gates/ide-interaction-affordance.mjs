#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

async function assertNoRuntimeErrors(page, errors) {
  const consoleErrors = errors.filter((message) => !/favicon/i.test(message));
  assert(consoleErrors.length === 0, `page must not emit console/page errors: ${consoleErrors.join(' | ')}`);
}

function boxesOverlap(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function describeBox(box) {
  return `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`;
}

function assertNoOverlap(first, second, message) {
  assert(
    !boxesOverlap(first, second),
    `${message}: first=${describeBox(first)}, second=${describeBox(second)}`
  );
}

async function assertTargetCenterUnobstructed(page, target, message) {
  const box = await target.boundingBox();
  assert(box, `${message}: target must be measurable`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const usable = await target.evaluate((element, targetPoint) => {
    const hit = document.elementFromPoint(targetPoint.x, targetPoint.y);
    return Boolean(hit && (hit === element || element.contains(hit)));
  }, point);
  assert(usable, `${message}: center hit target is obstructed at ${JSON.stringify(point)}`);
}

await runIdeGate('IDE interaction affordance contract satisfied', async ({ page, baseUrl }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=interaction-affordance`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  const buildBadge = page.locator('[data-testid="ide-build-badge"]').first();
  assert(await visible(buildBadge), 'build identity must be visible before browser interaction proof');

  const orientation = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  assert(await visible(orientation), 'first Project launch must show workflow orientation');
  assert(
    (await orientation.getAttribute('data-onboarding-placement')) === 'integrated',
    'first Project launch workflow orientation must be integrated with the command center'
  );
  const orientationBox = await orientation.boundingBox();
  const launchTargets = [
    page.locator('[data-testid="ide-project-start-a-lab-primary"]').first(),
    page.locator('[data-testid="ide-project-build-fresh-primary"]').first(),
    page.locator('[data-testid="ide-project-open-starter-primary"]').first(),
    page.locator('[data-testid="ide-project-import-primary"]').first(),
    page.locator('[data-testid="ide-project-open-existing-primary"]').first(),
  ];
  assert(orientationBox, 'workflow orientation must be measurable');
  for (const target of launchTargets) {
    if (!(await target.isVisible().catch(() => false))) continue;
    await assertTargetCenterUnobstructed(page, target, 'workflow orientation must not block Project launch actions');
  }

  await page.locator('[data-testid="ide-onboarding-skip"]').first().click();
  await orientation.waitFor({ state: 'hidden', timeout: 10000 });

  const helpButton = page.locator('[data-testid="ide-topbar-help-btn"]').first();
  assert(await visible(helpButton), 'top bar must keep one visible Help affordance');
  assert((await page.locator('[data-testid="ide-topbar-help-btn"]').count()) === 1, 'top bar must not duplicate Help controls');
  await helpButton.click();
  const shortcuts = page.locator('[data-testid="ide-shortcuts-modal"]').first();
  await shortcuts.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Keyboard Shortcuts/i.test(await text(shortcuts)), 'Help must open usable keyboard guidance');
  await page.locator('[data-testid="ide-shortcuts-close"]').first().click();
  await shortcuts.waitFor({ state: 'hidden', timeout: 10000 });

  const renameButton = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await visible(renameButton), 'top-bar project title must be an obvious rename affordance');
  await renameButton.click();

  const renameInput = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  assert(await visible(renameInput), 'clicking the project title must open an inline rename input');
  assert(
    (await renameInput.inputValue()) === 'Untitled Project',
    'rename input must start with the current project title'
  );

  await renameInput.fill('Should Not Save');
  await renameInput.press('Escape');
  assert(
    /Untitled Project/.test(await text(page.locator('[data-testid="ide-top-bar"]').first())),
    'Escape must cancel project rename without corrupting the current title'
  );

  await renameButton.click();
  await renameInput.fill('EE 141 Lab 2');
  await renameInput.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('EE 141 Lab 2'), undefined, { timeout: 10000 });

  const topbarText = await text(page.locator('[data-testid="ide-top-bar"]').first());
  assert(topbarText.includes('EE 141 Lab 2'), `renamed title must be visible in top bar, got "${topbarText}"`);
  assert(
    !(await page.locator('[data-testid="ide-project-identity-strip"]').first().isVisible().catch(() => false)),
    'blank Project must not duplicate the top-bar identity authority'
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForFunction(() => document.body.innerText.includes('EE 141 Lab 2'), undefined, { timeout: 10000 });
  assert(
    (await text(page.locator('[data-testid="ide-top-bar"]').first())).includes('EE 141 Lab 2'),
    'project rename must persist across reload'
  );
  assert(
    !(await page.locator('[data-testid="ide-onboarding-overlay"]').first().isVisible().catch(() => false)),
    'dismissed workflow orientation must stay out of the way after reload'
  );
  assert(await visible(helpButton), 'Help affordance must survive reload');

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await page.locator('[data-testid="ide-project-change-project"]').first().click();
  await page.waitForSelector('[data-testid="ide-project-entry-paths"]', { timeout: 15000 });
  assert(
    !(await page.locator('[data-testid="ide-onboarding-overlay"]').first().isVisible().catch(() => false)),
    'loaded Project must not inherit the full workflow orientation card by default'
  );
  assert(
    await visible(helpButton),
    'loaded Project must keep the single Help affordance'
  );
  await helpButton.click();
  await shortcuts.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="ide-shortcuts-close"]').first().click();
  await shortcuts.waitFor({ state: 'hidden', timeout: 10000 });
  assert(await visible(page.locator('[data-testid="ide-project-entry-paths"]').first()), 'closing Help must restore Project path interaction');

  await assertNoRuntimeErrors(page, errors);
});
