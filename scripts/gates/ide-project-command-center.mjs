#!/usr/bin/env node

import { assert, assertBuildFreshReplacementDialog, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

async function dismissOnboardingIfPresent(page) {
  const skipButton = page.locator('[data-testid="ide-onboarding-skip"]').first();
  const overlay = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  if (!(await skipButton.isVisible().catch(() => false))) return;
  await skipButton.click();
  await overlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
}

async function dismissWorkflowOrientationIfPresent(page) {
  const dismissButton = page.getByRole('button', { name: /^dismiss$/i }).first();
  if (!(await dismissButton.isVisible().catch(() => false))) return;
  await dismissButton.click();
  await dismissButton.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
}

async function assertNoPrematureDownstreamWarnings(locator, label) {
  const content = (await text(locator)).toLowerCase();
  const forbidden = [
    'other starts are secondary',
    'certified course path',
    'start here for the ece141',
    'mapping 0 missing',
    'required basys3 i/o mappings are missing',
    'export stays blocked',
    'before circuit',
  ];
  const hit = forbidden.find((phrase) => content.includes(phrase));
  assert(!hit, `${label} must not show premature or course-first copy: "${hit}"`);
}

async function assertFitsViewport(page, locator, label) {
  const box = await locator.first().boundingBox();
  assert(box, `${label} must have a measurable layout box`);
  const viewport = page.viewportSize();
  assert(viewport, `${label} gate requires a viewport`);
  assert(box.x >= -1, `${label} must not overflow left edge: x=${box.x}`);
  assert(box.x + box.width <= viewport.width + 1, `${label} must not overflow right edge`);
  assert(box.y + box.height <= viewport.height + 12, `${label} must fit in the first viewport`);
}

async function assertLaunchStarterDensity(page, label) {
  const disclosure = page.locator('[data-testid="ide-project-lab-gallery-disclosure"]').first();
  assert(await visible(disclosure), `${label} must keep the all-labs starter catalog reachable`);
  assert((await disclosure.getAttribute('open')) === null, `${label} all-labs starter catalog must begin collapsed`);
  await disclosure.locator('summary').click();
  const gallery = page.locator('[data-testid="ide-project-lab-gallery"]').first();
  assert(await visible(gallery), `${label} must expose the all-labs starter grid through its disclosure`);

  const visibleCards = page.locator('[data-testid^="ide-project-lab-card-"]:visible');
  const visibleCardCount = await visibleCards.count();
  assert(
    visibleCardCount >= 4,
    `${label} must show several all-lab starter choices, saw ${visibleCardCount}`
  );

  const box = await gallery.boundingBox();
  assert(box && box.width >= 320, `${label} starter grid must have a readable layout box`);
}

await runIdeGate('IDE project command center contract satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const launchViewports = [
    { label: '1366x768', width: 1366, height: 768 },
    { label: '1440x900', width: 1440, height: 900 },
    { label: '1920x1080', width: 1920, height: 1080 },
  ];

  for (const viewport of launchViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-command-center-${viewport.label}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
    await dismissOnboardingIfPresent(page);
    await dismissWorkflowOrientationIfPresent(page);

    const launchCenter = page.locator('[data-testid="ide-project-command-center"]').first();
    const launchLabel = `Project first-launch command center ${viewport.label}`;
    assert(await visible(launchCenter), 'Project first launch must render one command center');
    await assertFitsViewport(page, launchCenter, launchLabel);
    await assertNoPrematureDownstreamWarnings(launchCenter, launchLabel);

    const launchText = await text(launchCenter);
    assert(/start your circuit/i.test(launchText), `Project launch title must name the starting task, got "${launchText}"`);
    assert(/build fresh/i.test(launchText), 'Project command center must expose Build Fresh');
    assert(/course starter|starter/i.test(launchText), 'Project command center must expose a starter path');
    assert(/import|recover/i.test(launchText), 'Project command center must expose import/recovery');
    assert(/open saved|recent|continue/i.test(launchText), 'Project command center must expose saved/recent work');

    assert(
      await visible(page.locator('[data-testid="ide-project-build-fresh-primary"]').first()),
      'Project command center must keep Build Fresh as a first-class action'
    );
    assert(
      await visible(page.locator('[data-testid="ide-project-import-primary"]').first()),
      'Project command center must keep Import / recovery as a first-class action'
    );
    const starterCatalog = page.locator('[data-testid="ide-project-starter-catalog"]').first();
    assert(await visible(starterCatalog), 'Project command center must keep its starter catalog disclosure reachable');
    assert((await starterCatalog.getAttribute('open')) === null, 'Project starter catalog must begin collapsed');
    await page.locator('[data-testid="ide-project-open-starter-primary"]').first().click();
    assert(
      await visible(page.locator('[data-testid="ide-project-landing-example-logic-gates"]').first()),
      'Open Starter must reveal the Logic Gates starter'
    );
    await assertLaunchStarterDensity(page, launchLabel);
  }

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  const loadedCenter = page.locator('[data-testid="ide-project-command-center"]').first();
  assert(await visible(loadedCenter), 'Loaded Project must keep the command center visible');
  await assertNoPrematureDownstreamWarnings(loadedCenter, 'Loaded Project command center');

  assert(
    await visible(page.locator('[data-testid="ide-project-command-strip-primary-cta"]').first()),
    'Loaded Project command center must show one primary next action'
  );
  assert(
    !(await visible(page.locator('[data-testid="ide-project-entry-paths"]').first())),
    'Loaded Project must keep change-project paths collapsed until requested'
  );

  const continueAction = page.locator('[data-testid="ide-project-command-strip-primary-cta"]').first();
  assert(/continue design/i.test(await text(continueAction)), 'Loaded Project primary must continue to Design');
  await page.locator('[data-testid="ide-project-change-project"]').first().click();
  assert(await visible(page.locator('[data-testid="ide-project-entry-paths"]').first()), 'Change Project must reveal peer entry paths');

  const requiredPaths = [
    ['ide-project-path-build-fresh', 'build fresh'],
    ['ide-project-path-course-starter', 'starter'],
    ['ide-project-path-import-recover', 'import'],
    ['ide-project-path-open-existing', 'open'],
  ];
  for (const [testId, expectedText] of requiredPaths) {
    const path = page.locator(`[data-testid="${testId}"]`).first();
    assert(await visible(path), `Loaded Project command center must expose ${testId}`);
    assert(
      (await text(path)).toLowerCase().includes(expectedText),
      `${testId} must read as "${expectedText}"`
    );
  }

  const starterBrowser = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  if (await starterBrowser.isVisible().catch(() => false)) {
    const expanded = await starterBrowser.getAttribute('data-expanded');
    assert(expanded === 'false', 'Loaded Project must keep the starter browser collapsed by default');
  }

  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.locator('[data-testid="ide-project-path-build-fresh"]').first().click();
  await page.waitForTimeout(250);
  assertBuildFreshReplacementDialog(dialogMessage, 'Loaded Project Build Fresh');
  assert(
    await visible(page.locator('[data-testid="ide-mode-project"]').first()),
    'Dismissing the Build Fresh guard must leave the student on Project'
  );
});
