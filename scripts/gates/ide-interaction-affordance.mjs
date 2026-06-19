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
    page.locator('[data-testid="ide-project-primary-actions"]').first(),
    page.locator('[data-testid="ide-project-start-column"]').first(),
    page.locator('[data-testid="ide-project-landing-example-logic-gates"]').first(),
  ];
  assert(orientationBox, 'workflow orientation must be measurable');
  for (const target of launchTargets) {
    if (!(await target.isVisible().catch(() => false))) continue;
    const targetBox = await target.boundingBox();
    assert(targetBox, 'Project launch target must be measurable');
    assertNoOverlap(
      orientationBox,
      targetBox,
      'workflow orientation must not cover Project launch actions'
    );
  }

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

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await page.waitForSelector('[data-testid="ide-project-entry-paths"]', { timeout: 15000 });
  await orientationReopen.click();
  const loadedProjectOrientation = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  await loadedProjectOrientation.waitFor({ state: 'visible', timeout: 10000 });
  const loadedProjectOrientationBox = await loadedProjectOrientation.boundingBox();
  const entryPathsBox = await page.locator('[data-testid="ide-project-entry-paths"]').first().boundingBox();
  assert(loadedProjectOrientationBox && entryPathsBox, 'loaded Project orientation and entry paths must be measurable');
  assertNoOverlap(
    loadedProjectOrientationBox,
    entryPathsBox,
    'reopened workflow orientation must not cover loaded Project entry paths'
  );
  await page.locator('[data-testid="ide-onboarding-skip"]').first().click();
  await loadedProjectOrientation.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);

  await assertNoRuntimeErrors(page, errors);
});
