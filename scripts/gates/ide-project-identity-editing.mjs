#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

async function dismissOnboarding(page) {
  const skip = page.locator('[data-testid="ide-onboarding-skip"]').first();
  if (await visible(skip)) {
    await skip.click();
    await page.locator('[data-testid="ide-onboarding-overlay"]').first().waitFor({
      state: 'hidden',
      timeout: 10000,
    }).catch(() => null);
  }
}

async function ensureProjectMode(page) {
  if (await visible(page.locator('[data-testid="ide-mode-project"]').first())) return;
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await waitForProjectSurface(page, 'ensure-project-mode');
}

async function waitForProjectSurface(page, label) {
  const projectSurface = page.locator('[data-testid="ide-mode-project"]').first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await visible(projectSurface)) return;

    const projectButton = page.locator('[data-testid="mode-button-project"]').first();
    if (await visible(projectButton)) {
      await projectButton.click().catch(() => null);
    }
    await page.waitForTimeout(250);
    if (await visible(projectSurface)) return;

    if (attempt === 1) {
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    }
  }

  const snapshot = await page.evaluate(() => {
    const project = document.querySelector('[data-testid="ide-mode-project"]');
    const activeMode = document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? '';
    const activeButton = document.querySelector('[data-testid^="mode-button-"][data-active="true"]')?.getAttribute('data-testid') ?? '';
    const rect = project?.getBoundingClientRect();
    const style = project ? window.getComputedStyle(project) : null;
    return {
      label: document.location.href,
      activeMode,
      activeButton,
      projectRect: rect ? { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top) } : null,
      projectDisplay: style?.display ?? '',
      projectVisibility: style?.visibility ?? '',
      bodyTextStart: document.body.innerText.slice(0, 240),
    };
  });
  throw new Error(`${label}: Project surface did not become visible: ${JSON.stringify(snapshot)}`);
}

async function loadLogicGatesStarter(page) {
  const openStarter = page.locator('[data-testid="ide-project-open-starter-primary"]').first();
  if (await visible(openStarter)) {
    await openStarter.click();
  }
  const selectors = [
    '[data-testid="ide-project-landing-example-logic-gates"]',
    '[data-testid="ide-project-load-start-logic-gates"]',
    '[data-testid="ide-projectx-path-step-logic-gates"]',
  ];
  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if (!(await visible(candidate))) continue;
    await candidate.click();
    await Promise.race([
      page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 }),
      page.waitForSelector('[data-node-id]', { timeout: 10000 }),
    ]).catch(() => null);
    return;
  }
  throw new Error('Logic Gates starter was not available from Project');
}

async function assertBuildMatchesHead(page) {
  await assertBuildHash(page, 'Project identity editing');
}

async function renameFromTopBar(page, nextName, commitMode) {
  const titleButton = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await visible(titleButton), 'top-bar project title must be a visible rename affordance');
  await titleButton.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  assert(await visible(input), 'double-clicking the top-bar title must open inline rename');
  await input.fill(nextName);
  if (commitMode === 'escape') {
    await input.press('Escape');
    return;
  }
  if (commitMode === 'blur') {
    await page.locator('[data-testid="ide-board-chip"]').first().click();
    return;
  }
  await input.press('Enter');
}

async function renameFromProjectStrip(page, nextName, commitMode) {
  const stripTitle = page.locator('[data-testid="ide-project-identity-strip-title"]').first();
  assert(await visible(stripTitle), 'upper Project identity strip title must be visible');
  await stripTitle.dblclick();
  const input = page.locator('[data-testid="ide-project-identity-strip-input"]').first();
  assert(await visible(input), 'double-clicking the upper Project identity strip title must open inline rename');
  await input.fill(nextName);
  if (commitMode === 'escape') {
    await input.press('Escape');
    return;
  }
  if (commitMode === 'blur') {
    await page.locator('[data-testid="ide-project-command-strip"]').first().click();
    return;
  }
  await input.press('Enter');
}

async function assertTitleEverywhere(page, expectedName, options = {}) {
  const { loadedProject = true } = options;
  await page.waitForFunction((name) => document.body.innerText.includes(name), expectedName, {
    timeout: 10000,
  });
  const topbar = await text(page.locator('[data-testid="ide-top-bar"]').first());
  assert(topbar.includes(expectedName), `top-bar title must show "${expectedName}", got "${topbar}"`);
  if (loadedProject) {
    const identityStrip = await text(page.locator('[data-testid="ide-project-identity-strip"]').first());
    assert(
      identityStrip.includes(expectedName),
      `loaded Project identity strip must show "${expectedName}", got "${identityStrip}"`
    );
  } else {
    assert(
      !(await page.locator('[data-testid="ide-project-identity-strip"]').first().isVisible().catch(() => false)),
      'blank Project must not duplicate the top-bar identity authority',
    );
  }
}

async function runViewport(page, baseUrl, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-identity-editing-${label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-identity-editing-${label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await waitForProjectSurface(page, `${label}/fresh-project`);
  await assertBuildMatchesHead(page);
  await dismissOnboarding(page);

  await renameFromTopBar(page, `Canceled ${label}`, 'escape');
  assert(
    (await text(page.locator('[data-testid="ide-top-bar"]').first())).includes('Untitled Project'),
    'Escape from top-bar rename must keep the original project title'
  );

  await renameFromTopBar(page, `Blur Saved ${label}`, 'blur');
  await assertTitleEverywhere(page, `Blur Saved ${label}`, { loadedProject: false });

  await ensureProjectMode(page);
  await loadLogicGatesStarter(page);
  await ensureProjectMode(page);
  await page.waitForSelector('[data-testid="ide-project-command-center"]', { timeout: 10000 });

  const titleBefore = await text(page.locator('[data-testid="ide-project-identity-strip-title"]').first());
  assert(
    titleBefore.includes('Logic Gates'),
    `loaded starter Project title must be visible before rename, got "${titleBefore}"`
  );
  assert(
    await visible(page.locator('[data-testid="ide-project-identity-strip-title"]').first()),
    'loaded Project title must remain an obvious inline Rename affordance'
  );

  await renameFromProjectStrip(page, 'Should Not Save From Strip', 'escape');
  await assertTitleEverywhere(page, 'Logic Gates: AND / OR / XOR');

  const savedName = `EE 141 Logic Gates ${label}`;
  await renameFromProjectStrip(page, savedName, 'enter');
  await assertTitleEverywhere(page, savedName);

  const sourceOverview = page.locator('[data-testid="ide-project-workspace-context"]').first();
  assert(await visible(sourceOverview), 'renamed starter project must keep its current project overview visible');
  const sourceText = await text(sourceOverview);
  assert(
    sourceText.includes('Logic Gates: AND / OR / XOR') && !sourceText.includes(savedName),
    `starter source context must stay distinct from renamed project title, got "${sourceText}"`
  );

  await renameFromTopBar(page, `Blur Project ${label}`, 'blur');
  await assertTitleEverywhere(page, `Blur Project ${label}`);

  await page.locator('[data-testid="mode-button-design"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await waitForProjectSurface(page, `${label}/return-project`);
  await assertTitleEverywhere(page, `Blur Project ${label}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForProjectSurface(page, `${label}/reload-project`);
  await assertBuildMatchesHead(page);
  await assertTitleEverywhere(page, `Blur Project ${label}`);
}

await runIdeGate('IDE Project identity editing contract satisfied', async ({ page, baseUrl }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  for (const viewport of VIEWPORTS) {
    await runViewport(page, baseUrl, viewport);
  }

  const runtimeErrors = errors.filter((message) => !/favicon/i.test(message));
  assert(
    runtimeErrors.length === 0,
    `Project identity editing must not emit console/page errors: ${runtimeErrors.join(' | ')}`
  );
});
