#!/usr/bin/env node

import { assert, ensureVerifyVectorsReady, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { selectFirstVisibleDesignNode } from './_workbenchReconstructionHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function clickVerifyRun(page) {
  const candidates = [
    '[data-testid="ide-vcb-run"]',
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return;
    }
  }
  throw new Error('verify run button was not visible in any supported state');
}

await runIdeGate('IDE student loop contract satisfied', async ({ page, baseUrl }) => {
  // 1. Project: open the runtime examples catalog and load an example
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-project-import-primary"], [data-testid="ide-project-continue-cta"], [data-testid^="ide-project-landing-example-"]', { timeout: 10000 });

  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-signal-tour' });

  if (!(await page.locator('[data-testid="ide-mode-design"]').isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  }

  assert(
    (await page.locator('[data-testid="ide-right-dock"]').count()) === 0,
    'idle Design must keep the empty Inspector out of the circuit workspace',
  );
  await selectFirstVisibleDesignNode(page);
  assert(
    await page.locator('[data-testid="ide-design-selection-inspector"]').first().isVisible().catch(() => false),
    'selecting a circuit object must reveal its contextual Design Inspector',
  );

  // 2. Verify: generate basics -> run -> PASS/FAIL banner
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  await ensureVerifyVectorsReady(page);
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  const vectorTableVisible = await visible(vectorTable).catch(() => false);
  const vectorList = page.locator('[data-testid="ide-verify-vector-list-panel"]').first();
  const vectorListVisible = await visible(vectorList).catch(() => false);
  const vectorCountText = (
    await page.locator('[data-testid="ide-verify-vector-list-count"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  const authoringFormVisible = await visible(page.locator('[data-testid="ide-verify-add-vector-form"]').first()).catch(() => false);
  const runFooter = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runFooterVisible = await visible(runFooter).catch(() => false);
  const runFooterText = runFooterVisible ? ((await runFooter.textContent()) ?? '').trim() : '';
  const firstRunStateText = (
    await page
      .locator('[data-testid="ide-verify-empty-state"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  const commandStatusText = (
    await page
      .locator('[data-testid="ide-vcb-status"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  const headerRunVisible = await page
    .locator('[data-testid="ide-vcb-run"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    vectorTableVisible ||
      (vectorListVisible && /\d+/.test(vectorCountText)) ||
      authoringFormVisible ||
      /vector/i.test(runFooterText) ||
      /current vectors are ready|saved checks available/i.test(firstRunStateText) ||
      (/ready/i.test(commandStatusText) && headerRunVisible),
    'verify must surface authored vectors after generating basics',
  );

  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  const verifySummaryStatus = page.locator('[data-testid="ide-verify-summary-status"]').first();
  assert(await visible(verifySummaryStatus), 'verify summary status must be visible after run');

  const statusLabel = (
    await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(async () =>
        page
          .locator('[data-testid="ide-verify-summary-status"]')
          .first()
          .textContent()
          .catch(() => ''),
      )
  )?.trim() ?? '';
  assert(
    /PASS|FAIL|TRACE|ASSERTIONS|SIMULATION|OBSERVATION|STIMULUS|CHECKS/i.test(statusLabel),
    `verify status must reflect a completed compare/simulation state, got "${statusLabel}"`,
  );

  // 3. Export: gate state + Vivado command contract
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const exportPanel = page.locator('[data-testid="ide-export-panel"]').first();
  assert(await visible(exportPanel), 'export panel must be visible');

  const readinessHero = page.locator('[data-testid="ide-export-readiness-hero"]').first();
  const inspector = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
  assert(await visible(readinessHero), 'Export readiness authority must be visible');
  assert(await visible(inspector), 'Export package state must be visible');
  const packageState = await inspector.getAttribute('data-export-package-state');
  assert(['blocked', 'draft', 'ready'].includes(packageState ?? ''), `Export must expose a truthful package state, got ${packageState}`);

  const readinessLabel = (await inspector.textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
  assert(readinessLabel.length > 0, `Export readiness status must have non-empty text, got "${readinessLabel}"`);
  assert(/Browser E0|Cannot export|Draft|Ready/i.test(readinessLabel), 'Export readiness must name its package state or Browser E0 boundary');

  const primaryHandoff = page.locator('[data-testid="ide-export-primary-actions"] button').first();
  assert(await visible(primaryHandoff), 'Export readiness must expose one owning next action');

  if (packageState !== 'blocked') {
    const packageFiles = page.locator('[data-testid="ide-export-package-files"]').first();
    await packageFiles.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="ide-export-file-browser"]').first().waitFor({ state: 'visible', timeout: 10000 });
    const boundary = await page.locator('[data-testid="ide-export-e0-boundary-summary"]').first().textContent();
    assert(/Browser E0/i.test(boundary ?? ''), 'Export must retain its Browser E0 package boundary');
    assert(/external/i.test(boundary ?? ''), 'Export must keep Vivado and board proof external');
  }

  // 4. Hardware: panel + mode controls
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });

  const hardwarePanel = page.locator('[data-testid="ide-hardware-panel"]').first();
  assert(await visible(hardwarePanel), 'hardware panel must be visible');

  const afterMappingTools = page.locator('[data-testid="ide-hw-after-mapping-tools"]').first();
  await afterMappingTools.waitFor({ state: 'visible', timeout: 10000 });

  const hardwareModeToggle = page.locator('[data-testid="ide-hw-mode-toggle"]').first();
  assert(
    await visible(hardwareModeToggle),
    'hardware mode toggle must be visible',
  );

  // 4b. Hardware — after clicking Pre-flight, require proof-only active-mode
  // evidence. The readiness callout is an alternative only when it names an
  // unmet prerequisite. The always-present command strip and workflow ribbon
  // cannot prove transition.
  const proofModeButton = page.locator('[data-testid="ide-hw-mode-btn-proof"]').first();
  await proofModeButton.click();
  await page.waitForFunction(() => {
    const isVisibleElement = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return element.getClientRects().length > 0 && style.visibility !== 'hidden';
    };
    const proofButton = document.querySelector('[data-testid="ide-hw-mode-btn-proof"]');
    const proofVerdict = document.querySelector('[data-testid="ide-hw-proof-verdict"]');
    const proofDock = document.querySelector('[data-testid="ide-hw-proof-dock"]');
    const proofStage = document.querySelector('[data-testid="ide-hw-board-chrome-stage"]');
    const readinessCallout = document.querySelector('[data-testid="ide-hardware-readiness-callout"]');
    const readinessText = readinessCallout?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const proofSpecificState =
      proofButton?.getAttribute('aria-selected') === 'true' &&
      (isVisibleElement(proofVerdict) ||
        isVisibleElement(proofDock) ||
        (isVisibleElement(proofStage) && /Pre-flight/i.test(proofStage.textContent ?? '')));
    const explicitPrerequisite =
      isVisibleElement(readinessCallout) &&
      !/^E0 handoff ready\b/i.test(readinessText) &&
      /blocked|cannot|different|incomplete|locked|missing|must|needs?|not run|required|repair|re-?run|stale/i.test(
        readinessText,
      );
    return proofButton?.getAttribute('aria-selected') === 'true' &&
      (proofSpecificState || explicitPrerequisite);
  }, undefined, { timeout: 5000 });

  const proofModeSelected = (await proofModeButton.getAttribute('aria-selected')) === 'true';
  const hasProofVerdict = await page
    .locator('[data-testid="ide-hw-proof-verdict"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasProofDock = await page
    .locator('[data-testid="ide-hw-proof-dock"]')
    .first()
    .isVisible()
    .catch(() => false);
  const proofStage = page.locator('[data-testid="ide-hw-board-chrome-stage"]').first();
  const hasProofStage =
    (await proofStage.isVisible().catch(() => false)) &&
    /Pre-flight/i.test((await proofStage.textContent().catch(() => '')) ?? '');
  const readinessCallout = page.locator('[data-testid="ide-hardware-readiness-callout"]').first();
  const readinessCalloutVisible = await readinessCallout.isVisible().catch(() => false);
  const readinessText = ((await readinessCallout.textContent().catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const hasExplicitPrerequisite =
    readinessCalloutVisible &&
    !/^E0 handoff ready\b/i.test(readinessText) &&
    /blocked|cannot|different|incomplete|locked|missing|must|needs?|not run|required|repair|re-?run|stale/i.test(
      readinessText,
    );
  assert(
    proofModeSelected &&
      (hasProofVerdict || hasProofDock || hasProofStage || hasExplicitPrerequisite),
    'Pre-flight must become active with proof-specific workspace evidence, or show an explicit ' +
      `prerequisite blocker; selected=${proofModeSelected}, verdict=${hasProofVerdict}, ` +
      `dock=${hasProofDock}, stage=${hasProofStage}, readiness="${readinessText}"`,
  );
});
