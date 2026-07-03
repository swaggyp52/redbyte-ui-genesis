#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE six-page product spine flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runSixPageSpineFlow(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `six-page product spine browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `six-page product spine failures:\n${failures.join('\n')}`);
});

async function runSixPageSpineFlow(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=six-page-spine-${viewport.label}-fresh`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project fresh`);
  await assertProductSpine(page, viewport, 'project', {
    mustContain: [/Project/i, /No circuit/i, /Choose Start a Lab/i],
    boundary: /does not prove behavior/i,
  });

  await openLogicGatesStarter(page, baseUrl, `six-page-spine-${viewport.label}-starter`);
  await assertProductSpine(page, viewport, 'design', {
    mustContain: [/Design/i, /Open Verify/i, /circuit graph/i],
    boundary: /Compare proof belongs in Verify/i,
  });

  await openMode(page, baseUrl, 'verify', `six-page-spine-${viewport.label}`);
  await runComparePass(page);
  await assertProductSpine(page, viewport, 'verify', {
    mustContain: [/Verify/i, /Compare/i, /expected outputs/i],
    boundary: /browser E0 behavior/i,
  });

  await openMode(page, baseUrl, 'hardware', `six-page-spine-${viewport.label}`);
  await assertProductSpine(page, viewport, 'hardware', {
    mustContain: [/Hardware \/ Map Pins/i, /Map required pins/i, /Basys3/i],
    boundary: /E1.*bitstream.*board observation/i,
  });

  await openMode(page, baseUrl, 'export', `six-page-spine-${viewport.label}`);
  await assertProductSpine(page, viewport, 'export', {
    mustContain: [/Export/i, /package/i, /Vivado/i],
    boundary: /Vivado build.*bitstream.*board proof/i,
  });

  await openMode(page, baseUrl, 'import', `six-page-spine-${viewport.label}`);
  await assertProductSpine(page, viewport, 'import', {
    mustContain: [/Import \/ Recovery/i, /Cancel keeps the current project/i, /review/i],
    boundary: /not broad HDL migration proof/i,
  });

  await assertNoRootOverflow(page, `${viewport.label}/six-page product spine`);
}

async function assertProductSpine(page, viewport, mode, expectations) {
  await page.waitForSelector(`[data-testid="ide-product-spine-${mode}"]`, { timeout: 15000 });

  const state = await page.evaluate((activeMode) => {
    const root = document.querySelector(`[data-testid="ide-product-spine-${activeMode}"]`);
    const legacy = document.querySelector(`[data-testid="ide-next-step-guide-${activeMode}"]`);
    const primary = document.querySelector(`[data-testid="ide-product-spine-primary-${activeMode}"]`);
    const recovery = document.querySelector(`[data-testid="ide-product-spine-recovery-${activeMode}"]`);
    const status = document.querySelector(`[data-testid="ide-product-spine-status-${activeMode}"]`);
    const job = document.querySelector(`[data-testid="ide-product-spine-job-${activeMode}"]`);
    const done = document.querySelector(`[data-testid="ide-product-spine-done-${activeMode}"]`);
    const blocked = document.querySelector(`[data-testid="ide-product-spine-blocked-${activeMode}"]`);
    const boundary = document.querySelector(`[data-testid="ide-product-spine-boundary-${activeMode}"]`);
    const rect = root?.getBoundingClientRect();
    const style = root ? window.getComputedStyle(root) : null;
    const visibleWidth = rect
      ? Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left))
      : 0;
    const visibleHeight = rect
      ? Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))
      : 0;

    return {
      text: (root?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      legacyText: (legacy?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      primaryText: (primary?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      recoveryText: (recovery?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      statusText: (status?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      jobText: (job?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      doneText: (done?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      blockedText: (blocked?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      boundaryText: (boundary?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      rect: rect
        ? {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visibleWidth: Math.round(visibleWidth),
            visibleHeight: Math.round(visibleHeight),
          }
        : null,
      visible: Boolean(
        rect &&
          rect.width > 1 &&
          rect.height > 1 &&
          visibleWidth > 1 &&
          visibleHeight > 1 &&
          style &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
      ),
      primaryVisible: Boolean(primary),
      recoveryVisible: Boolean(recovery),
      factsPresent: Boolean(job && done && blocked && boundary),
    };
  }, mode);

  assert(state.visible, `${viewport.label}/${mode}: product spine is not visible ${JSON.stringify(state.rect)}`);
  assert(state.rect.top <= 150, `${viewport.label}/${mode}: product spine starts too low ${JSON.stringify(state.rect)}`);
  assert(
    state.rect.visibleWidth >= Math.min(720, Math.round(viewport.width * 0.62)),
    `${viewport.label}/${mode}: product spine too narrow ${JSON.stringify(state.rect)}`
  );
  assert(
    state.rect.visibleHeight <= Math.round(viewport.height * 0.34),
    `${viewport.label}/${mode}: product spine too tall ${JSON.stringify(state.rect)}`
  );
  assert(/What do I do next\?/i.test(state.legacyText), `${viewport.label}/${mode}: old next-step selector lost prompt text`);
  assert(state.factsPresent, `${viewport.label}/${mode}: missing job/done/blocked/boundary facts`);
  assert(state.primaryVisible, `${viewport.label}/${mode}: primary action/copy missing`);
  assert(state.recoveryVisible, `${viewport.label}/${mode}: recovery action/copy missing`);
  assert(state.statusText.length > 0, `${viewport.label}/${mode}: status is empty`);
  assert(state.jobText.length > 0, `${viewport.label}/${mode}: job is empty`);
  assert(state.doneText.length > 0, `${viewport.label}/${mode}: done condition is empty`);
  assert(state.blockedText.length > 0, `${viewport.label}/${mode}: blocked condition is empty`);
  assert(expectations.boundary.test(state.boundaryText), `${viewport.label}/${mode}: boundary mismatch "${state.boundaryText}"`);

  for (const pattern of expectations.mustContain) {
    assert(
      pattern.test(state.text) || pattern.test(state.primaryText) || pattern.test(state.recoveryText),
      `${viewport.label}/${mode}: expected ${pattern} in "${state.text.slice(0, 320)}"`
    );
  }
}
