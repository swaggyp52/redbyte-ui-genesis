#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

async function assertNoRuntimeErrors(page, errors) {
  const consoleErrors = errors.filter((message) => !/favicon/i.test(message));
  assert(consoleErrors.length === 0, `page must not emit console/page errors: ${consoleErrors.join(' | ')}`);
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
  const orientationBox = await orientation.boundingBox();
  const commandCenterBox = await page.locator('[data-testid="ide-project-command-center"]').first().boundingBox();
  assert(orientationBox && commandCenterBox, 'workflow orientation and command center must be measurable');
  assert(
    orientationBox.y > commandCenterBox.y + 80,
    `workflow orientation should not cover the Project primary actions: overlay y=${orientationBox.y}, command center y=${commandCenterBox.y}`
  );

  await page.locator('[data-testid="ide-onboarding-skip"]').first().click();
  await orientation.waitFor({ state: 'hidden', timeout: 10000 });

  const orientationReopen = page.locator('[data-testid="ide-topbar-workflow-help-btn"]').first();
  assert(await visible(orientationReopen), 'dismissed workflow orientation must have a visible reopen affordance');
  await orientationReopen.click();
  await page.locator('[data-testid="ide-onboarding-overlay"]').first().waitFor({ state: 'visible', timeout: 10000 });
  assert(
    /workflow orientation/i.test(await text(page.locator('[data-testid="ide-onboarding-overlay"]').first())),
    'reopened orientation must explain the workflow'
  );
  await page.locator('[data-testid="ide-onboarding-skip"]').first().click();
  await orientation.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);

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
  const projectSurfaceText = await text(page.locator('[data-testid="ide-project-identity-strip"]').first());
  assert(topbarText.includes('EE 141 Lab 2'), `renamed title must be visible in top bar, got "${topbarText}"`);
  assert(
    projectSurfaceText.includes('EE 141 Lab 2'),
    `renamed title must be visible on Project surface, got "${projectSurfaceText}"`
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
  assert(await visible(orientationReopen), 'workflow orientation reopen affordance must survive reload');

  await assertNoRuntimeErrors(page, errors);
});
