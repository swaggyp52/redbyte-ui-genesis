#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1366x768-equivalent-125pct', width: 1093, height: 614 },
];

await runIdeGate('IDE hardware mapping conflict repair satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];
  await installCleanStudentContext(page);

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=hardware-mapping-conflict-repair-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
      await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
      await loadStarterProject(page, { exactExampleId: 'logic-gates' });
      await openModeByClick(page, 'verify', `${viewport.label}/baseline Verify`);
      await generateStarterTestbenchIfNeeded(page, viewport);
      await rerunCurrentCompare(page, viewport);
      assert(
        isVerifyPass(await text(page.getByTestId('ide-verify-summary-status').first())),
        `${viewport.label}: baseline Compare did not PASS before mapping`,
      );
      await openModeByClick(page, 'hardware', `${viewport.label}/Map Pins`);
      await proveConflictRepair(page, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware conflict repair browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware conflict repair failures:\n${failures.join('\n')}`);
});

async function proveConflictRepair(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Map Pins`);
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 15000 });
  assert(await visible(page.getByTestId('ide-hw-map-row-sw0').first()), `${viewport.label}: SW0 row is missing`);
  assert(await visible(page.getByTestId('ide-hw-map-row-sw1').first()), `${viewport.label}: SW1 row is missing`);
  assert(/0/.test(await text(page.getByTestId('ide-hw-mapping-overview-conflicts').first())), `${viewport.label}: baseline has conflicts`);

  await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const row = runtime?.projectIoRows?.find((entry) => /sw1/i.test(String(entry.label ?? entry.id ?? '')));
    if (!runtime?.setMappingPin || !row) throw new Error('Unable to seed the duplicate SW0 mapping fixture.');
    runtime.setMappingPin(row.id, 'SW0');
  });
  await page.getByTestId('ide-hw-map-row-sw1').first().click();
  await page.getByTestId('ide-hw-selected-mapping-conflict').first().waitFor({ state: 'visible', timeout: 10000 });

  assert(/2/.test(await text(page.getByTestId('ide-hw-mapping-overview-conflicts').first())), `${viewport.label}: duplicate conflict count is not 2`);
  assert(/conflict|resolve/i.test(await text(page.getByTestId('ide-hw-map-row-status-sw0').first())), `${viewport.label}: SW0 conflict is hidden`);
  assert(/conflict|resolve/i.test(await text(page.getByTestId('ide-hw-map-row-status-sw1').first())), `${viewport.label}: SW1 conflict is hidden`);
  assert(/sw1/i.test(await text(page.getByTestId('ide-hardware-chain-signal').first())), `${viewport.label}: selected signal is not SW1`);
  const conflictingArtifactPort = await text(page.getByTestId('ide-hardware-chain-artifact').first());
  assert(/artifact port\s*sw$/i.test(conflictingArtifactPort), `${viewport.label}: generated artifact port is not SW: ${conflictingArtifactPort}`);
  assert(/sw0|slide switch 0/i.test(await text(page.getByTestId('ide-hardware-chain-board').first())), `${viewport.label}: selected resource is not SW0`);
  assert(/v17/i.test(await text(page.getByTestId('ide-hardware-chain-pin').first())), `${viewport.label}: selected package pin is not V17`);
  const conflictingXdc = await text(page.getByTestId('ide-hardware-basys3-binding-xdc').first());
  assert(
    /package_pin\s+v17.*get_ports\s+\{?sw\}?/i.test(conflictingXdc),
    `${viewport.label}: conflicting XDC consequence is missing: ${conflictingXdc}`,
  );

  await openModeByClick(page, 'export', `${viewport.label}/blocked Export`);
  await page.locator('[data-testid="ide-export-package-inspector-v1"][data-export-package-state="blocked"]').first()
    .waitFor({ state: 'visible', timeout: 15000 });
  assert(/map pins/i.test(await text(page.getByTestId('ide-export-upstream-mapping').first())), `${viewport.label}: Export does not assign the blocker to Map Pins`);
  assert(await visible(page.getByTestId('ide-export-package-files').first()), `${viewport.label}: blocked Export must keep pending package files inspectable`);
  await selectExportFileByName(page, /top\.xdc/i, `${viewport.label}/blocked Export`);
  assert(/top\.xdc/i.test(await text(page.getByTestId('ide-export-preview-path').first())), `${viewport.label}: blocked Export did not select top.xdc`);
  await page.getByTestId('ide-export-blocked-open-map-pins').first().click();
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 15000 });

  await page.getByTestId('ide-hw-map-row-sw1').first().click();
  const select = page.getByTestId('ide-hw-direct-resource-select').first();
  const editorControlFloor = await page.evaluate(() => {
    const label = document.querySelector('.ide-hw-v3__field');
    const resourceSelect = document.querySelector('[data-testid="ide-hw-direct-resource-select"]');
    return {
      labelFontSize: label instanceof HTMLElement ? Number.parseFloat(getComputedStyle(label).fontSize) : 0,
      selectFontSize: resourceSelect instanceof HTMLElement ? Number.parseFloat(getComputedStyle(resourceSelect).fontSize) : 0,
      selectHeight: resourceSelect instanceof HTMLElement ? resourceSelect.getBoundingClientRect().height : 0,
    };
  });
  assert(editorControlFloor.labelFontSize >= 13.9, `${viewport.label}: selected-signal label is below 14px ${JSON.stringify(editorControlFloor)}`);
  assert(editorControlFloor.selectFontSize >= 13.9, `${viewport.label}: selected-signal resource control text is below 14px ${JSON.stringify(editorControlFloor)}`);
  assert(editorControlFloor.selectHeight >= 35.5, `${viewport.label}: selected-signal resource control is below 36px ${JSON.stringify(editorControlFloor)}`);
  assert(
    /sw0.*v17.*already assigned/i.test(await text(select.locator('option[value="SW0"]').first())),
    `${viewport.label}: used resource is not identified as already assigned`,
  );
  await select.selectOption('SW2');
  assert(/sw2.*w16.*top\.xdc/i.test(await text(page.getByTestId('ide-hw-selected-mapping-consequence').first())), `${viewport.label}: repair consequence is incomplete`);
  await page.getByTestId('ide-hw-assign-selected-resource').first().click();
  await page.waitForFunction(() => /0/.test(document.querySelector('[data-testid="ide-hw-mapping-overview-conflicts"]')?.textContent ?? ''), {
    timeout: 10000,
  });

  assert(/assigned|mapped/i.test(await text(page.getByTestId('ide-hw-map-row-status-sw0').first())), `${viewport.label}: SW0 did not recover`);
  assert(/assigned|mapped/i.test(await text(page.getByTestId('ide-hw-map-row-status-sw1').first())), `${viewport.label}: SW1 did not recover`);
  assert(await visible(page.getByTestId('ide-hw-continue-export').first()), `${viewport.label}: Export handoff is missing after repair`);
  const repairedChain = await text(page.getByTestId('ide-hardware-basys3-binding-chain').first());
  assert(/sw1.*sw2.*w16/i.test(repairedChain), `${viewport.label}: repaired chain is not current: ${repairedChain}`);

  await page.getByTestId('ide-hw-continue-export').first().click();
  await page.waitForSelector('[data-testid="ide-export-package-inspector-v1"]', { timeout: 15000 });
  const repairedInspector = page.getByTestId('ide-export-package-inspector-v1').first();
  assert(
    (await repairedInspector.getAttribute('data-export-package-state')) === 'draft',
    `${viewport.label}: repaired mapping must leave Export draft until Verify is current`,
  );
  assert(
    /stale|verify/i.test(await text(page.getByTestId('ide-export-upstream-verify').first())),
    `${viewport.label}: repaired mapping does not expose stale Verify ownership`,
  );

  await openModeByClick(page, 'verify', `${viewport.label}/stale Verify`);
  const refreshedStatus = await rerunCurrentCompare(page, viewport);
  assert(isVerifyPass(refreshedStatus), `${viewport.label}: refreshed Compare did not PASS: ${refreshedStatus}`);

  await openModeByClick(page, 'export', `${viewport.label}/current Export`);
  const currentInspector = page.getByTestId('ide-export-package-inspector-v1').first();
  const currentState = await currentInspector.getAttribute('data-export-package-state');
  assert(
    currentState === 'draft' || currentState === 'ready',
    `${viewport.label}: verified Export must be draft or ready, got ${currentState}`,
  );
  assert(await visible(page.getByTestId('ide-export-package-files').first()), `${viewport.label}: repaired Export package is not inspectable`);
  await selectExportFileByName(page, /top\.xdc/i, `${viewport.label}/current Export`);
  assert(/package_pin\s+w16/i.test(await text(page.getByTestId('ide-export-preview-code').first())), `${viewport.label}: top.xdc did not receive repaired pin`);

  await assertNoRootOverflow(page, `${viewport.label}/Map Pins and Export repair`);
}

async function rerunCurrentCompare(page, viewport) {
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare is unavailable after mapping repair`);
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null,
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (prior) => {
      const next = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(next && next !== prior);
    },
    previousReportHash,
    { timeout: 20000 },
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  return text(page.getByTestId('ide-verify-summary-status').first());
}

async function generateStarterTestbenchIfNeeded(page, viewport) {
  const generate = page.getByTestId('ide-vcb-generate').first();
  if (!(await visible(generate))) return;
  await generate.click();
  await page.waitForFunction(
    () => {
      const run = document.querySelector('[data-testid="ide-vcb-run"]');
      const generateAction = document.querySelector('[data-testid="ide-vcb-generate"]');
      return Boolean(run && !run.hasAttribute('disabled') && !generateAction);
    },
    null,
    { timeout: 10000 },
  ).catch(() => null);
  assert(!(await visible(generate)), `${viewport.label}: starter testbench generation did not commit cases`);
}

async function openModeByClick(page, mode, label) {
  const button = page.getByTestId(`mode-button-${mode}`).first();
  assert(await visible(button), `${label}: workflow navigation control is unavailable`);
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(120);
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (!(await visible(target))) continue;
    await target.click();
    return;
  }
  throw new Error(`${label} was not visible`);
}

async function selectExportFileByName(page, name, label) {
  const browser = page.getByTestId('ide-export-file-browser').first();
  assert(await visible(browser), `${label}: generated package file browser is unavailable`);
  const file = browser.getByRole('button', { name }).first();
  assert(await visible(file), `${label}: ${name} is not available in the generated package file browser`);
  await file.click();
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
