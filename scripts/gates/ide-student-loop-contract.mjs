#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
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

  // 2. Simulate: authored cases -> run -> completed result
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const caseTable = page.getByTestId('ide-case-lab-table');
  if (!(await caseTable.isVisible())) await page.getByTestId('ide-verify-view-table').click();
  await caseTable.waitFor({ state: 'visible', timeout: 10000 });
  const caseRows = caseTable.locator('[data-testid^="ide-case-lab-row-"]');
  if (await caseRows.count() === 0) {
    await page.getByTestId('ide-case-lab-generate').click();
    await caseRows.first().waitFor({ state: 'visible', timeout: 10000 });
  }
  const authoredCaseCount = Number((await page.getByTestId('ide-case-lab-count').textContent())?.trim());
  assert(authoredCaseCount > 0 && authoredCaseCount === await caseRows.count(),
    'Simulate must expose its authored cases and matching case count before the run');
  assert(await page.getByTestId('ide-vcb-run').isEnabled(), 'The populated scenario must expose an enabled Run action');
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

  const readinessState = page.getByTestId('ide-export-derived-state');
  assert(await visible(readinessState), 'Export must show its current package decision');
  const readinessLabel = (await readinessState.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
  assert(readinessLabel.length > 0, `Export readiness status must have non-empty text, got "${readinessLabel}"`);
  assert(/blocks export|draft|not built|stale|current|ready|downloaded/i.test(readinessLabel),
    `Export readiness must name its current package decision, got "${readinessLabel}"`);

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

  const firstMappedSignal = page.locator('[data-testid^="ide-hw-map-row-signal-"]').first();
  await firstMappedSignal.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid^="ide-hw-map-row-action-"]').first().click();
  const selectedArtifact = page.locator('[data-testid="ide-hardware-chain-artifact"]').first();
  assert(
    /Artifact port/i.test((await selectedArtifact.textContent()) ?? ''),
    'Selected mapping detail must label artifact-port identity separately from the logical port and physical resource',
  );

  const afterMappingTools = page.locator('[data-testid="ide-hw-after-mapping-tools"]').first();
  await afterMappingTools.waitFor({ state: 'visible', timeout: 10000 });

  const hardwareModeToggle = page.locator('[data-testid="ide-hw-mode-toggle"]').first();
  assert(
    await visible(hardwareModeToggle),
    'hardware mode toggle must be visible',
  );

  // 4b. Hardware: after clicking Board Check, require tool-specific active-mode
  // evidence: the tool selected, and its dock (a step to perform, or the offer to
  // generate vectors) or the stage naming Board Check. The readiness callout is
  // an alternative only when it names an unmet prerequisite. The always-present
  // command strip and workflow ribbon cannot prove transition. (Pre-flight, the
  // fourth mode this step used to enter, restated Package's trust state on the
  // Board and is retired.)
  const bringupModeButton = page.locator('[data-testid="ide-hw-mode-btn-bringup"]').first();
  await bringupModeButton.click();
  const boardCheck = page.locator('[data-testid="ide-hw-bringup-dock"]').first();
  await boardCheck.waitFor({ state: 'visible', timeout: 10000 });
  assert(await visible(page.locator('[data-testid="ide-hw-bringup-step"], [data-testid="ide-hw-bringup-generate"]').first()), 'Board Check must show a reference step or a way to generate one');
  assert(/no physical.board observation/i.test(await page.locator('[data-testid="ide-hw-board-workspace"]').textContent()), 'browser reference must keep physical evidence separate');
  await page.locator('[data-testid="ide-hw-board-check-exit"]').click();
  assert(await visible(page.locator('[data-testid="ide-hw-map-table"]')), 'Board Check must provide a working return to assignments');
});
