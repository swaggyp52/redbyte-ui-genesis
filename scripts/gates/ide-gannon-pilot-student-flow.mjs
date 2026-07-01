#!/usr/bin/env node

import {
  assert,
  runIdeGate,
  visible,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const GANNON_LABS = [
  { id: 'logic-gates', exampleId: 'logic-gates', startText: /Start Logic Gates/i },
  { id: 'half-adder', exampleId: 'half-adder', startText: /Start Half Adder/i },
  { id: 'full-adder', exampleId: 'full-adder', startText: /Start Full Adder/i },
  { id: 'four-bit-adder', exampleId: 'four-bit-adder', startText: /Start 4-Bit Adder/i },
  { id: 'counter-sequential', exampleId: 'two-bit-counter', startText: /Start Counter/i },
];

await runIdeGate('IDE Gannon Pilot student flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runGannonPilotFlow(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Gannon Pilot browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Gannon Pilot flow failures:\n${failures.join('\n')}`);
});

async function runGannonPilotFlow(page, baseUrl, viewport) {
  await openFreshProject(page, baseUrl, `gannon-pilot-${viewport.label}-landing`);
  await assertProjectLanding(page, viewport);
  await assertGannonLabPack(page, viewport);

  await startGannonLab(page, baseUrl, viewport, GANNON_LABS[0]);
  await assertReplacementCancelCopy(page, viewport);
  await assertExistingSurfacesAndGuides(page, baseUrl, viewport);
  await assertExportStudentSubmissionBoundary(page, baseUrl, viewport);
  await assertImportReviewBeforeReplace(page, baseUrl, viewport);

  await startGannonLab(page, baseUrl, viewport, GANNON_LABS[2]);
  await startGannonLab(page, baseUrl, viewport, GANNON_LABS[3]);
  await startGannonLab(page, baseUrl, viewport, GANNON_LABS[4]);

  await assertNoRootOverflow(page, `${viewport.label}/Gannon Pilot flow`);
}

async function openFreshProject(page, baseUrl, gateLabel) {
  await page.goto('about:blank');
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=${gateLabel}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
}

async function assertProjectLanding(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Project`);
  await assertText(page, '[data-testid="ide-next-step-guide-project"]', /What do I do next\?/i, `${viewport.label}: Project next-step rail`);
  await assertText(page, '[data-testid="ide-project-primary-actions"]', /Start a Lab/i, `${viewport.label}: Start a Lab primary action`);
  await assertText(page, '[data-testid="ide-project-primary-actions"]', /Build fresh/i, `${viewport.label}: Build fresh primary action`);
  await assertText(page, '[data-testid="ide-project-primary-actions"]', /Open Starter/i, `${viewport.label}: Open Starter primary action`);
  await assertText(page, '[data-testid="ide-project-primary-actions"]', /Import \/ Recover/i, `${viewport.label}: Import / Recover primary action`);
}

async function assertGannonLabPack(page, viewport) {
  const startLab = page.locator('[data-testid="ide-project-start-a-lab-primary"]').first();
  assert(await visible(startLab), `${viewport.label}: Start a Lab primary button missing`);
  await startLab.click();

  const pack = page.locator('[data-testid="ide-project-gannon-lab-pack"]').first();
  assert(await visible(pack), `${viewport.label}: Gannon Pilot lab pack missing`);
  await assertText(page, '[data-testid="ide-project-gannon-lab-pack"]', /Gannon Pilot lab pack/i, `${viewport.label}: lab pack heading`);
  await assertText(page, '[data-testid="ide-project-gannon-lab-pack"]', /Vivado build, bitstream, and board observation stay external/i, `${viewport.label}: lab pack proof boundary`);
  await assertText(page, '[data-testid="ide-instructor-note"]', /For instructors/i, `${viewport.label}: instructor note`);

  for (const lab of GANNON_LABS) {
    await ensureLabExpanded(page, viewport, lab.id);
    await assertText(page, `[data-testid="ide-project-gannon-lab-card-${lab.id}"]`, /Build:/i, `${viewport.label}: ${lab.id} build copy`);
    await assertText(page, `[data-testid="ide-project-gannon-lab-card-${lab.id}"]`, /Submit:/i, `${viewport.label}: ${lab.id} submit copy`);
    await assertText(page, `[data-testid="ide-project-gannon-lab-card-${lab.id}"]`, lab.startText, `${viewport.label}: ${lab.id} start button`);
  }
}

async function startGannonLab(page, baseUrl, viewport, lab) {
  await openFreshProject(page, baseUrl, `gannon-pilot-${viewport.label}-${lab.id}`);
  await ensureLabExpanded(page, viewport, lab.id);
  const start = page.locator(`[data-testid="ide-project-gannon-lab-start-${lab.id}"]`).first();
  assert(await visible(start), `${viewport.label}: ${lab.id} start button missing`);
  await start.click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/${lab.id}/Design`);

  const activeExampleId = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.activeExampleId ?? null);
  assert(
    activeExampleId === lab.exampleId,
    `${viewport.label}: ${lab.id} loaded ${activeExampleId ?? 'none'} instead of ${lab.exampleId}`
  );
}

async function ensureLabExpanded(page, viewport, labId) {
  const card = page.locator(`[data-testid="ide-project-gannon-lab-card-${labId}"]`).first();
  const details = page.locator(`[data-testid="ide-project-gannon-lab-details-${labId}"]`).first();
  assert(await visible(details), `${viewport.label}: ${labId} card details button missing`);
  if ((await card.getAttribute('data-expanded').catch(() => 'false')) !== 'true') {
    await details.click();
  }
  const expanded = await card.getAttribute('data-expanded');
  assert(expanded === 'true', `${viewport.label}: ${labId} card did not open`);
}

async function assertReplacementCancelCopy(page, viewport) {
  const projectButton = page.locator('[data-testid="mode-button-project"]').first();
  if (await projectButton.isVisible().catch(() => false)) {
    await projectButton.click();
  }
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });
  const buildFresh = page.locator('[data-testid="ide-project-path-build-fresh"], [data-testid="ide-project-build-fresh-primary"]').first();
  assert(await visible(buildFresh), `${viewport.label}: Build Fresh destructive action missing`);
  await buildFresh.click();
  await page.waitForTimeout(200);
  assert(/Cancel keeps your current work/i.test(dialogMessage), `${viewport.label}: Build Fresh dialog missing Cancel preservation copy: ${dialogMessage}`);
  assert(/Confirm means replace current work/i.test(dialogMessage), `${viewport.label}: Build Fresh dialog missing Confirm replacement copy: ${dialogMessage}`);

  const activeExampleId = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.activeExampleId ?? null);
  assert(activeExampleId === 'logic-gates', `${viewport.label}: canceled Build Fresh changed active example to ${activeExampleId ?? 'none'}`);
}

async function assertExistingSurfacesAndGuides(page, baseUrl, viewport) {
  for (const mode of ['design', 'verify', 'hardware', 'export', 'import']) {
    await openMode(page, baseUrl, mode, `gannon-pilot-${viewport.label}-${mode}`);
    await assertBuildHash(page, `${viewport.label}/${mode}`);
    await assertText(page, `[data-testid="ide-next-step-guide-${mode}"]`, /What do I do next\?/i, `${viewport.label}: ${mode} next-step rail`);
  }
}

async function assertExportStudentSubmissionBoundary(page, baseUrl, viewport) {
  await openMode(page, baseUrl, 'export', `gannon-pilot-${viewport.label}-export-submission`);
  await assertText(page, '[data-testid="ide-export-student-submit-guidance"]', /Download RedByte\/Vivado ZIP/i, `${viewport.label}: export ZIP submission copy`);
  await assertText(page, '[data-testid="ide-export-student-submit-guidance"]', /Submit the ZIP to your instructor/i, `${viewport.label}: submit-to-instructor copy`);
  await assertText(page, '[data-testid="ide-export-student-submit-guidance"]', /browser-E0 package generation only/i, `${viewport.label}: browser E0 boundary`);
  await assertText(page, '[data-testid="ide-export-evidence-boundary"]', /E1/i, `${viewport.label}: E1 boundary visible`);
  await assertText(page, '[data-testid="ide-export-evidence-boundary"]', /E2/i, `${viewport.label}: E2 boundary visible`);
  await assertText(page, '[data-testid="ide-export-evidence-boundary"]', /E3/i, `${viewport.label}: E3 boundary visible`);
}

async function assertImportReviewBeforeReplace(page, baseUrl, viewport) {
  await openMode(page, baseUrl, 'import', `gannon-pilot-${viewport.label}-import-review`);
  await assertText(page, '[data-testid="ide-import-safety-boundary-v1"]', /No overwrite before review/i, `${viewport.label}: import no-overwrite boundary`);
  await assertText(page, '[data-testid="ide-import-start-guidance"]', /Confirm Replace Project/i, `${viewport.label}: import confirm-replace copy`);
  await assertText(page, '[data-testid="ide-next-step-guide-import"]', /Cancel keeps the current project/i, `${viewport.label}: import next-step cancel copy`);
}

async function assertText(page, selector, pattern, label) {
  const locator = page.locator(selector).first();
  assert(await visible(locator), `${label}: ${selector} not visible`);
  const text = ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  assert(pattern.test(text), `${label}: expected ${pattern} in "${text.slice(0, 240)}"`);
}
