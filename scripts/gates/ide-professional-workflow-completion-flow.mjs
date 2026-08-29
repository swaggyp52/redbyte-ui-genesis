#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
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
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', {
  paths: [resolve(process.cwd(), 'packages', 'rb-apps')],
}));

const ALL_VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1366x768-equivalent-125pct', width: 1093, height: 614 },
];
const VIEWPORTS = process.env.RB_GATE_VIEWPORT
  ? ALL_VIEWPORTS.filter((viewport) => viewport.label === process.env.RB_GATE_VIEWPORT)
  : ALL_VIEWPORTS;

assert(
  VIEWPORTS.length > 0,
  `Unknown RB_GATE_VIEWPORT "${process.env.RB_GATE_VIEWPORT}". Expected one of ${ALL_VIEWPORTS.map(({ label }) => label).join(', ')}`,
);

const EVIDENCE_ROOT = resolve('.redbyte/product-immersion/rebrand-completion/after/gate');
const INVALID_IMPORT_FIXTURE = resolve(EVIDENCE_ROOT, 'not-a-zip.txt');
const VALID_IMPORT_FIXTURE = resolve(EVIDENCE_ROOT, 'professional-workflow-recovery-and.zip');

await mkdir(EVIDENCE_ROOT, { recursive: true });
await writeFile(INVALID_IMPORT_FIXTURE, 'This is intentionally not a ZIP archive.\n', 'utf8');
await buildValidImportFixture(VALID_IMPORT_FIXTURE);

await runIdeGate('IDE professional workflow completion flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const records = [];
  const failures = [];

  await installCleanStudentContext(page);

  for (const viewport of VIEWPORTS) {
    try {
      records.push(await runViewportFlow(page, baseUrl, viewport));
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
      await capture(page, viewport, 'failure').catch(() => null);
    }
  }
  const metricFailures = collectMetricFailures(records);

  await writeFile(
    resolve(EVIDENCE_ROOT, 'metrics.json'),
    `${JSON.stringify({
      gate: 'ide-professional-workflow-completion-flow',
      generatedAtIso: new Date().toISOString(),
      records,
      browserProblems,
      failures,
      metricFailures,
    }, null, 2)}\n`,
    'utf8',
  );

  assert(
    browserProblems.length === 0,
    `Professional workflow emitted browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`,
  );
  assert(
    failures.length === 0 && metricFailures.length === 0,
    [
      failures.length > 0 ? `Professional workflow failures:\n${failures.join('\n')}` : '',
      metricFailures.length > 0 ? `Professional workflow metric failures:\n${metricFailures.join('\n')}` : '',
    ].filter(Boolean).join('\n'),
  );
});

async function runViewportFlow(page, baseUrl, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(
    `${baseUrl}/?mode=project&e2e=1&gate=professional-workflow-completion-${viewport.label}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/startup`);

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });

  const surfaces = [];

  await openModeByClick(page, 'project', `${viewport.label}/Project`);
  await assertProject(page, viewport);
  surfaces.push(await collectSurfaceMetrics(page, viewport, 'project'));
  await capture(page, viewport, 'project-overview');

  await openModeByClick(page, 'design', `${viewport.label}/Design`);
  await assertDesign(page, viewport);
  surfaces.push(await collectSurfaceMetrics(page, viewport, 'design'));
  await capture(page, viewport, 'design-workspace');

  await openModeByClick(page, 'verify', `${viewport.label}/Verify`);
  await assertVerify(page, viewport);
  surfaces.push(await collectSurfaceMetrics(page, viewport, 'verify'));
  await capture(page, viewport, 'verify-repaired-pass');

  await openModeByClick(page, 'hardware', `${viewport.label}/Map Pins`);
  surfaces.push(await assertMapPinsAndExport(page, viewport));
  surfaces.push(await collectSurfaceMetrics(page, viewport, 'export'));
  await capture(page, viewport, 'export-inspector');

  surfaces.push(await assertImport(page, viewport));
  await capture(page, viewport, 'import-applied');

  return { viewport, surfaces };
}

async function assertProject(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Project`);
  const overview = page.getByTestId('ide-project-professional-overview').first();
  assert(await visible(overview), `${viewport.label}/Project: useful project overview is missing`);

  const overviewText = await normalizedText(overview);
  for (const required of ['Board', 'Design', 'Verify', 'Map Pins', 'Export']) {
    assert(
      overviewText.toLowerCase().includes(required.toLowerCase()),
      `${viewport.label}/Project: overview does not include ${required}`,
    );
  }
  assert(
    await visible(page.getByTestId('ide-project-readiness-workspace').first()),
    `${viewport.label}/Project: workflow readiness is missing`,
  );
  assert(
    await visible(page.getByTestId('ide-project-mapping-overview').first()),
    `${viewport.label}/Project: mapping summary is missing`,
  );

  const primary = page.getByTestId('ide-project-command-strip-primary-cta').first();
  assert(await visible(primary), `${viewport.label}/Project: one Continue action is required`);
  assert(
    (await page.locator('[data-testid="ide-project-command-strip"] .ide-button-primary:visible').count()) === 1,
    `${viewport.label}/Project: expected exactly one primary Continue action`,
  );

  const alternatives = page.locator('[data-testid="ide-project-context-change"]:visible, [data-testid="ide-project-change-project"]:visible').first();
  assert(await visible(alternatives), `${viewport.label}/Project: change/recover alternatives are missing`);
  await alternatives.click();
  assert(
    await visible(page.getByTestId('ide-project-path-import-recover').first()),
    `${viewport.label}/Project: Import recovery must be reachable from the project chooser`,
  );
  await alternatives.click();
  await assertNoRootOverflow(page, `${viewport.label}/Project`);
}

async function assertDesign(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Design`);
  const canvas = page.getByTestId('ide-design-live-canvas').first();
  assert(await visible(canvas), `${viewport.label}/Design: live circuit canvas is missing`);
  assert(
    await visible(page.getByTestId('ide-design-toolbar').first()),
    `${viewport.label}/Design: primary toolbar is missing`,
  );

  const before = await readProjectSnapshot(page);
  for (const view of ['split', 'hdl', 'canvas']) {
    const button = page.getByTestId(`ide-design-view-${view}`).first();
    assert(await visible(button), `${viewport.label}/Design: direct ${view} view control is missing`);
    await button.click();
    await page.waitForFunction(
      ([requestedView, viewportWidth]) => {
        const active = document.querySelector('[data-testid="ide-design-pane-row"]')?.getAttribute('data-design-view');
        return requestedView === 'split'
          ? active === 'split' || (viewportWidth <= 1100 && active === 'stacked')
          : active === requestedView;
      },
      [view, viewport.width],
      { timeout: 5000 },
    );
  }
  const after = await readProjectSnapshot(page);
  assertSameProjectSnapshot(before, after, `${viewport.label}/Design: Canvas/Code/Split transitions changed project state`);

  await selectAndGate(page);
  const shell = page.getByTestId('ide-mode-design').first();
  assert(
    (await shell.getAttribute('data-support-dock-policy')) === 'stable',
    `${viewport.label}/Design: Library and Inspector must use the stable v3 dock policy`,
  );

  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const value = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (value.width <= 1 || value.height <= 1 || style.display === 'none' || style.visibility === 'hidden') return null;
      return { top: value.top, width: value.width, height: value.height };
    };
    const left = rect('[data-testid="ide-left-dock"]');
    const canvas = rect('[data-testid="ide-design-live-canvas"]');
    const right = rect('[data-testid="ide-right-dock"]');
    return {
      canvas,
      workspace: rect('[data-testid="ide-surface-grid"]'),
      center: rect('[data-testid="ide-design-control-bar"]'),
      left,
      right,
      share: (canvas?.width ?? 0) / Math.max(1, (left?.width ?? 0) + (canvas?.width ?? 0) + (right?.width ?? 0)),
    };
  });
  assert(geometry.canvas && geometry.workspace && geometry.center && geometry.left && geometry.right, `${viewport.label}/Design: stable Library, canvas, and Inspector geometry is unavailable`);
  assert(
    geometry.left.width >= 180 && geometry.left.width <= 230,
    `${viewport.label}/Design: Library width is unstable at ${geometry.left.width}px`,
  );
  if (viewport.width >= 1200) {
    assert(
      geometry.right.width >= 210 && geometry.right.width <= 290,
      `${viewport.label}/Design: Inspector width is unstable at ${geometry.right.width}px`,
    );
    const minimumShare = viewport.width >= 1800 ? 0.70 : viewport.width >= 1440 ? 0.66 : 0.64;
    assert(
      Number(geometry.share.toFixed(2)) >= minimumShare,
      `${viewport.label}/Design: canvas share ${geometry.share.toFixed(3)} is not dominant`,
    );
  } else {
    assert(
      geometry.right.width >= geometry.canvas.width * 0.85,
      `${viewport.label}/Design: responsive Inspector is not a stable lower detail region`,
    );
    assert(
      geometry.right.top >= geometry.canvas.top + geometry.canvas.height - 8,
      `${viewport.label}/Design: responsive Inspector does not follow the canvas`,
    );
  }

  const verifyRoutes = await page.getByTestId('ide-mode-design').locator('button:visible').evaluateAll((buttons) =>
    buttons.filter((button) => /open verify|continue to verify/i.test(button.textContent ?? '')).length,
  );
  assert(verifyRoutes <= 1, `${viewport.label}/Design: found ${verifyRoutes} competing Verify routes`);
  await assertNoRootOverflow(page, `${viewport.label}/Design`);
}

async function assertVerify(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Verify`);
  await page.waitForSelector('[data-testid="ide-testbench-documents"]', { timeout: 15000 });
  assert(
    await visible(page.getByTestId('ide-verify-context-scenario').first()),
    `${viewport.label}/Verify: named testbench document is missing`,
  );
  const authoringPath = page.getByTestId('ide-verify-authoring-path').first();
  assert(await visible(authoringPath), `${viewport.label}/Verify: direct authoring path is missing`);
  assert(
    /combinational case table/i.test(await normalizedText(authoringPath)),
    `${viewport.label}/Verify: combinational project did not open the case-table authoring path`,
  );
  const authoringSummary = await normalizedText(page.getByTestId('ide-verify-stimulus-header').first());
  assert(
    /testbench cases.*inputs.*expected/i.test(authoringSummary),
    `${viewport.label}/Verify: the case table does not explain stimulus and expected-output ownership`,
  );

  await createNamedTestbench(page, viewport);
  await exerciseCaseSafety(page, viewport);
  const expectedCell = await pickExpectedCell(page);
  await setExpectedCell(page, expectedCell.testId, expectedCell.value === 0 ? 1 : 0);
  await setExpectedCell(page, expectedCell.testId, expectedCell.value);

  assert(
    await setVerifyRunMode(page, 'observe'),
    `${viewport.label}/Verify: Observe mode must be selectable`,
  );
  await clickRunAwaitHash(page);
  const observedState = await normalizedText(page.getByTestId('ide-verify-context-state').first());
  const observedSummary = await normalizedText(page.getByTestId('ide-verify-results-summary').first());
  assert(
    /observation only/i.test(observedState) && /observed outputs recorded.*no expected checks compared/i.test(observedSummary),
    `${viewport.label}/Verify: Observe must remain non-proof while producing observed evidence, got state=${observedState} summary=${observedSummary}`,
  );

  assert(
    await setVerifyRunMode(page, 'compare'),
    `${viewport.label}/Verify: Compare mode must be selectable`,
  );
  let status = await clickRunAwaitStatus(page);
  assert(isVerifyPass(status), `${viewport.label}/Verify: baseline Compare should PASS, got ${status}`);

  await setExpectedCell(page, expectedCell.testId, expectedCell.value === 0 ? 1 : 0);
  await page.waitForFunction(
    () => /checks changed.*rerun compare/i.test(document.querySelector('[data-testid="ide-verify-primary-status"]')?.textContent ?? ''),
    undefined,
    { timeout: 5000 },
  );
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Verify: Compare disappeared after edit`);
  status = await clickRunAwaitStatus(page);
  assert(isVerifyFail(status), `${viewport.label}/Verify: wrong expected value should FAIL, got ${status}`);
  assert(
    await visible(page.getByTestId('ide-verify-repair-testbench-path').first()),
    `${viewport.label}/Verify: expected-output repair path is missing`,
  );
  assert(
    await visible(page.getByTestId('ide-verify-repair-design-path').first()),
    `${viewport.label}/Verify: circuit repair path is missing`,
  );

  await setExpectedCell(page, expectedCell.testId, expectedCell.value);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Verify: Compare disappeared after repair`);
  status = await clickRunAwaitStatus(page);
  assert(isVerifyPass(status), `${viewport.label}/Verify: repaired Compare should PASS, got ${status}`);

  const regionGeometry = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1
        ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height }
        : null;
    };
    return {
      authoring: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
    };
  });
  assert(regionGeometry.authoring, `${viewport.label}/Verify: testbench authoring region is hidden`);
  assert(regionGeometry.waveform, `${viewport.label}/Verify: waveform region is hidden after a run`);
  const overlaps = regionGeometry.authoring && regionGeometry.waveform
    ? Math.max(0, Math.min(regionGeometry.authoring.right, regionGeometry.waveform.right) - Math.max(regionGeometry.authoring.left, regionGeometry.waveform.left))
      * Math.max(0, Math.min(regionGeometry.authoring.bottom, regionGeometry.waveform.bottom) - Math.max(regionGeometry.authoring.top, regionGeometry.waveform.top))
    : 0;
  assert(overlaps <= 4, `${viewport.label}/Verify: waveform overlaps the testbench editor`);
  await assertNoRootOverflow(page, `${viewport.label}/Verify`);
}

async function assertMapPinsAndExport(page, viewport) {
  await assertBuildHash(page, `${viewport.label}/Map Pins`);
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 15000 });
  assert(await visible(page.getByTestId('ide-hw-mapping-overview').first()), `${viewport.label}/Map Pins: progress is missing`);
  assert(await visible(page.getByTestId('ide-hw-map-table').first()), `${viewport.label}/Map Pins: mapping table is missing`);
  assert(
    (await page.getByTestId('ide-hw-map-board').first().getAttribute('data-work-priority')) === 'reference',
    `${viewport.label}/Map Pins: board must remain a reference`,
  );

  await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const row = runtime?.projectIoRows?.find((entry) => /sw1/i.test(String(entry.label ?? entry.id ?? '')));
    if (!runtime?.setMappingPin || !row) throw new Error('Unable to seed the duplicate SW0 mapping fixture.');
    runtime.setMappingPin(row.id, 'SW0');
  });
  await page.getByTestId('ide-hw-map-row-sw1').first().click();
  await page.getByTestId('ide-hw-selected-mapping-conflict').first().waitFor({ state: 'visible', timeout: 10000 });
  assert(
    /2/.test(await normalizedText(page.getByTestId('ide-hw-mapping-overview-conflicts').first())),
    `${viewport.label}/Map Pins: duplicate assignment did not surface both conflicts`,
  );
  assert(/sw1/i.test(await normalizedText(page.getByTestId('ide-hardware-chain-signal').first())), `${viewport.label}/Map Pins: selected signal is not SW1`);
  assert(/sw0|slide switch 0/i.test(await normalizedText(page.getByTestId('ide-hardware-chain-board').first())), `${viewport.label}/Map Pins: selected resource is not SW0`);
  assert(/v17/i.test(await normalizedText(page.getByTestId('ide-hardware-chain-pin').first())), `${viewport.label}/Map Pins: selected package pin is not V17`);
  await capture(page, viewport, 'map-pins-conflict');

  await openModeByClick(page, 'export', `${viewport.label}/blocked Export`);
  const blocked = page.locator('[data-testid="ide-export-package-inspector-v1"][data-export-package-state="blocked"]').first();
  await blocked.waitFor({ state: 'visible', timeout: 15000 });
  assert(
    /duplicate pin assignment|mapping blocker/i.test(await normalizedText(page.getByTestId('ide-export-upstream-mapping').first())),
    `${viewport.label}/Export: duplicate mapping owner is not explicit`,
  );
  assert(
    await visible(page.getByTestId('ide-export-package-files').first()),
    `${viewport.label}/Export: blocked v3 state must keep generated files inspectable`,
  );
  assert(
    await visible(page.getByTestId('ide-export-file-browser').first()),
    `${viewport.label}/Export: blocked v3 state is missing the package file browser`,
  );
  assert(
    /blocked|pending/i.test(await normalizedText(page.getByTestId('ide-export-file-browser').first())),
    `${viewport.label}/Export: blocked file statuses are not explicit`,
  );
  await capture(page, viewport, 'export-blocked');
  await page.getByTestId('ide-export-blocked-open-map-pins').first().click();
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 15000 });

  await page.getByTestId('ide-hw-map-row-sw1').first().click();
  const resourceSelect = page.getByTestId('ide-hw-direct-resource-select').first();
  const usedResource = resourceSelect.locator('option[value="SW0"]').first();
  assert(
    /sw0.*v17.*already assigned/i.test(await normalizedText(usedResource)),
    `${viewport.label}/Map Pins: used SW0 resource does not name the conflicting signal`,
  );
  await resourceSelect.selectOption('SW2');
  assert(
    /sw2.*w16.*top\.xdc/i.test(await normalizedText(page.getByTestId('ide-hw-selected-mapping-consequence').first())),
    `${viewport.label}/Map Pins: repair consequence does not name resource, pin, and XDC`,
  );
  await page.getByTestId('ide-hw-assign-selected-resource').first().click();
  await page.waitForFunction(() => /0/.test(document.querySelector('[data-testid="ide-hw-mapping-overview-conflicts"]')?.textContent ?? ''), {
    timeout: 10000,
  });
  assert(
    await visible(page.getByTestId('ide-hw-continue-export').first()),
    `${viewport.label}/Map Pins: repaired mapping must offer Export handoff`,
  );
  await capture(page, viewport, 'map-pins-repaired');
  const hardwareMetrics = await collectSurfaceMetrics(page, viewport, 'hardware');

  await page.getByTestId('ide-hw-continue-export').first().click();
  await page.waitForSelector('[data-testid="ide-export-package-inspector-v1"]', { timeout: 15000 });
  const repairedInspector = page.getByTestId('ide-export-package-inspector-v1').first();
  assert(
    (await repairedInspector.getAttribute('data-export-package-state')) === 'draft',
    `${viewport.label}/Export: mapping change must leave a draft until Verify is current`,
  );
  assert(
    /stale|verify/i.test(await normalizedText(page.getByTestId('ide-export-upstream-verify').first())),
    `${viewport.label}/Export: stale Verify ownership is not explicit after mapping repair`,
  );
  await clickFirstVisible(
    page,
    [
      '[data-testid="ide-export-package-build-v1"]',
      '[data-testid="ide-export-open-verify-advisory"]',
      '[data-testid="ide-export-go-verify"]',
    ],
    'Export Verify repair action',
  );
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Verify: Compare unavailable after mapping repair`);
  const refreshedStatus = await clickRunAwaitStatus(page);
  assert(isVerifyPass(refreshedStatus), `${viewport.label}/Verify: refreshed Compare should PASS, got ${refreshedStatus}`);

  await openModeByClick(page, 'export', `${viewport.label}/current Export`);
  const currentInspector = page.getByTestId('ide-export-package-inspector-v1').first();
  const currentState = await currentInspector.getAttribute('data-export-package-state');
  assert(
    currentState === 'draft' || currentState === 'ready',
    `${viewport.label}/Export: current verified package must be draft or ready, got ${currentState}`,
  );
  assert(
    await visible(page.getByTestId('ide-export-upstream-readiness').first()),
    `${viewport.label}/Export: upstream readiness is missing`,
  );
  assert(
    await visible(page.getByTestId('ide-export-package-files').first()),
    `${viewport.label}/Export: repaired draft/ready package must be inspectable`,
  );
  assert(
    await visible(page.getByTestId('ide-export-file-browser').first()),
    `${viewport.label}/Export: package file browser is missing`,
  );
  await selectExportFileByName(page, /top\.xdc/i, `${viewport.label}/current Export`);
  assert(
    /package_pin\s+w16/i.test(await normalizedText(page.getByTestId('ide-export-preview-code').first())),
    `${viewport.label}/Export: repaired top.xdc preview is not current`,
  );
  const boundary = await normalizedText(page.getByTestId('ide-export-e0-boundary-summary').first());
  assert(
    /browser e0.*generation only.*vivado build.*programming.*physical board behavior.*external/i.test(boundary),
    `${viewport.label}/Export: Browser E0 boundary is incomplete: ${boundary}`,
  );
  assert(
    !/E1\s+(?:ready|passed|complete)|E2\s+(?:ready|passed|complete)|E3\s+(?:ready|passed|complete)/i.test(
      await normalizedText(page.getByTestId('ide-mode-export').first()),
    ),
    `${viewport.label}/Export: external proof is overclaimed`,
  );

  const packageAction = currentState === 'ready'
    ? page.getByTestId('ide-export-package-download-v1').first()
    : page.getByTestId('ide-export-package-build-v1').first();
  assert(await visible(packageAction), `${viewport.label}/Export: build/download package action is missing`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    packageAction.click(),
  ]);
  const downloadFailure = await download.failure();
  assert(!downloadFailure, `${viewport.label}/Export: package download failed: ${downloadFailure}`);
  await download.saveAs(resolve(EVIDENCE_ROOT, `${viewport.label}-redbyte-package.zip`));
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-export-package-inspector-v1"]')?.getAttribute('data-export-package-state') === 'ready',
    { timeout: 10000 },
  );
  await assertNoRootOverflow(page, `${viewport.label}/Export`);
  return hardwareMetrics;
}

async function assertImport(page, viewport) {
  await openModeByClick(page, 'import', `${viewport.label}/Import`);
  await assertBuildHash(page, `${viewport.label}/Import`);
  const track = page.getByTestId('ide-import-horizontal-stepper').first();
  assert(await visible(track), `${viewport.label}/Import: horizontal Upload/Review/Apply track is missing`);
  const steps = await track.locator('li').allTextContents();
  assert(
    steps.length === 3 && /upload/i.test(steps[0]) && /review/i.test(steps[1]) && /apply/i.test(steps[2]),
    `${viewport.label}/Import: expected Upload -> Review -> Apply, got ${JSON.stringify(steps)}`,
  );
  assert(
    /without replacing current work early/i.test(await normalizedText(page.getByTestId('ide-import-workbench').first())),
    `${viewport.label}/Import: no-early-replacement boundary is not explicit`,
  );

  const before = await readProjectSnapshot(page);
  const firstUpload = page.getByTestId('ide-import-zip-browse').first();
  assert(await visible(firstUpload), `${viewport.label}/Import: primary ZIP upload action is missing`);
  const [invalidChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    firstUpload.click(),
  ]);
  await invalidChooser.setFiles(INVALID_IMPORT_FIXTURE);
  const error = page.getByTestId('ide-import-zip-error').first();
  await error.waitFor({ state: 'visible', timeout: 15000 });
  const errorText = await normalizedText(error);
  assert(
    /zip|archive/i.test(errorText) && /no files were changed|active project was not changed/i.test(errorText),
    `${viewport.label}/Import: invalid ZIP recovery must name the correction and no-change boundary`,
  );
  const afterInvalid = await readProjectSnapshot(page);
  assertSameProjectSnapshot(before, afterInvalid, `${viewport.label}/Import: invalid input changed current work`);

  const recoveryBrowse = page.getByTestId('ide-import-retry-zip').first();
  assert(await visible(recoveryBrowse), `${viewport.label}/Import: invalid ZIP did not expose a visible Select ZIP recovery`);
  const [validChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    recoveryBrowse.click(),
  ]);
  await validChooser.setFiles(VALID_IMPORT_FIXTURE);
  await page.getByTestId('ide-import-zip-inspection').first().waitFor({ state: 'visible', timeout: 15000 });
  const reviewButton = page.getByTestId('ide-import-replace-project').first();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="ide-import-replace-project"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, { timeout: 15000 });
  await reviewButton.click();
  await page.getByTestId('ide-import-commit-preview').first().waitFor({ state: 'visible', timeout: 15000 });
  assert(
    /cancel keeps the current project unchanged/i.test(
      await normalizedText(page.getByTestId('ide-import-review-before-replace').first()),
    ),
    `${viewport.label}/Import: Apply step does not state cancel preservation`,
  );
  const beforeCancel = await readProjectSnapshot(page);
  assertSameProjectSnapshot(before, beforeCancel, `${viewport.label}/Import: Review changed current work before Apply`);
  await page.getByTestId('ide-import-apply-cancel').first().click();
  const afterCancel = await readProjectSnapshot(page);
  assertSameProjectSnapshot(beforeCancel, afterCancel, `${viewport.label}/Import: Cancel did not preserve current work`);

  await reviewButton.click();
  await page.getByTestId('ide-import-commit-preview').first().waitFor({ state: 'visible', timeout: 15000 });
  const importMetrics = await collectSurfaceMetrics(page, viewport, 'import');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('ide-import-apply-confirm').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 30000 });
  const applied = await readProjectSnapshot(page);
  assert(applied.semanticJson !== before.semanticJson, `${viewport.label}/Import: Apply did not replace the prior project`);
  assert(applied.projectId === 'professional-workflow-recovery-and', `${viewport.label}/Import: fixture project id was not applied`);
  assert(applied.projectName === 'Professional Workflow Recovery AND', `${viewport.label}/Import: fixture identity was not applied (got ${applied.projectName})`);
  assert(applied.projectKind === 'import', `${viewport.label}/Import: applied project kind is ${applied.projectKind}`);
  assert(applied.importMeta !== null, `${viewport.label}/Import: applied project is missing import provenance`);
  assert(applied.nodes === 4, `${viewport.label}/Import: structural sample should restore 4 nodes, got ${applied.nodes}`);
  assert(applied.connections === 3, `${viewport.label}/Import: structural sample should restore 3 connections, got ${applied.connections}`);
  assert(
    ['LD0', 'SW0', 'SW1'].every((label) => applied.ioLabels.includes(label)),
    `${viewport.label}/Import: applied sample ports are incomplete (${JSON.stringify(applied.ioLabels)})`,
  );
  assert(applied.vectorCount === 4, `${viewport.label}/Import: fixture testbench should restore 4 cases, got ${applied.vectorCount}`);
  assert(
    applied.verifyLastRunStatus === null && applied.dirtySinceVerify === true,
    `${viewport.label}/Import: applied project did not require fresh Verify proof`,
  );
  await assertNoRootOverflow(page, `${viewport.label}/Import applied`);
  return importMetrics;
}

async function createNamedTestbench(page, viewport) {
  const documents = page.getByTestId('ide-testbench-documents').first();
  assert(await visible(documents), `${viewport.label}/Verify: direct testbench documents are missing`);
  await page.getByTestId('ide-scenario-create-btn').first().click();
  await page.getByTestId('ide-scenario-rename-btn').first().click();
  const input = page.getByTestId('ide-scenario-rename-input').first();
  await input.fill(`Workflow ${viewport.label}`);
  await input.press('Enter');
  await page.waitForFunction(
    (name) => document.querySelector('[data-testid="ide-verify-context-scenario"]')?.textContent?.includes(name),
    `Workflow ${viewport.label}`,
    { timeout: 5000 },
  );
}

async function exerciseCaseSafety(page, viewport) {
  const editor = page.getByTestId('ide-verify-add-vector-form').first();
  assert(await visible(editor), `${viewport.label}/Verify: editable case grid is missing`);
  const target = page.getByTestId('ide-stimulus-tick-target').first();
  const initialCount = await target.locator('option').count();
  const addCase = page.getByTestId('ide-stimulus-add-tick').first();
  await addCase.scrollIntoViewIfNeeded();
  const addCaseReachability = await addCase.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    let left = Math.max(0, rect.left);
    let top = Math.max(0, rect.top);
    let right = Math.min(window.innerWidth, rect.right);
    let bottom = Math.min(window.innerHeight, rect.bottom);
    const clippingAncestors = [];
    for (let ancestor = button.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const clipsX = /(auto|scroll|hidden|clip)/.test(style.overflowX);
      const clipsY = /(auto|scroll|hidden|clip)/.test(style.overflowY);
      if (!clipsX && !clipsY) continue;
      const ancestorRect = ancestor.getBoundingClientRect();
      if (clipsX) {
        left = Math.max(left, ancestorRect.left);
        right = Math.min(right, ancestorRect.right);
      }
      if (clipsY) {
        top = Math.max(top, ancestorRect.top);
        bottom = Math.min(bottom, ancestorRect.bottom);
      }
      clippingAncestors.push({
        className: typeof ancestor.className === 'string' ? ancestor.className : '',
        testId: ancestor.getAttribute('data-testid') ?? '',
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        rect: { left: ancestorRect.left, top: ancestorRect.top, right: ancestorRect.right, bottom: ancestorRect.bottom },
        clientHeight: ancestor.clientHeight,
        scrollHeight: ancestor.scrollHeight,
      });
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = centerX >= 0 && centerX <= window.innerWidth && centerY >= 0 && centerY <= window.innerHeight
      ? document.elementFromPoint(centerX, centerY)
      : null;
    const stimulus = document.querySelector('[data-testid="ide-verify-region-stimulus"]')?.getBoundingClientRect() ?? null;
    const waveform = document.querySelector('[data-testid="ide-verify-region-waveform"]')?.getBoundingClientRect() ?? null;
    const regionOverlap = stimulus && waveform
      ? Math.max(0, Math.min(stimulus.right, waveform.right) - Math.max(stimulus.left, waveform.left))
        * Math.max(0, Math.min(stimulus.bottom, waveform.bottom) - Math.max(stimulus.top, waveform.top))
      : 0;
    return {
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      clippedWidth: Math.max(0, right - left),
      clippedHeight: Math.max(0, bottom - top),
      centerHit: Boolean(topElement && (topElement === button || button.contains(topElement))),
      topElement: topElement
        ? { tagName: topElement.tagName.toLowerCase(), className: typeof topElement.className === 'string' ? topElement.className : '', testId: topElement.getAttribute('data-testid') ?? '' }
        : null,
      clippingAncestors,
      stimulus: stimulus
        ? { left: stimulus.left, top: stimulus.top, right: stimulus.right, bottom: stimulus.bottom, width: stimulus.width, height: stimulus.height }
        : null,
      waveform: waveform
        ? { left: waveform.left, top: waveform.top, right: waveform.right, bottom: waveform.bottom, width: waveform.width, height: waveform.height }
        : null,
      regionOverlap,
    };
  });
  assert(
    addCaseReachability.clippedWidth >= 1 && addCaseReachability.clippedHeight >= 1 && addCaseReachability.centerHit,
    `${viewport.label}/Verify: Add case is not hit-testable ${JSON.stringify(addCaseReachability)}`,
  );
  assert(
    addCaseReachability.regionOverlap <= 4,
    `${viewport.label}/Verify: pre-run waveform overlaps the testbench editor (${addCaseReachability.regionOverlap}px2) ${JSON.stringify({ stimulus: addCaseReachability.stimulus, waveform: addCaseReachability.waveform })}`,
  );
  await addCase.click({ trial: true });
  await addCase.click();
  assert(
    (await target.locator('option').count()) === initialCount + 1,
    `${viewport.label}/Verify: Add case did not create a case`,
  );
  const lastValue = await target.locator('option').last().getAttribute('value');
  assert(lastValue != null, `${viewport.label}/Verify: new case has no tick identity`);
  await target.selectOption(lastValue);
  await page.getByTestId(`ide-stimulus-delete-tick-${lastValue}`).first().click();
  assert(
    await visible(page.getByTestId('ide-stimulus-delete-confirmation').first()),
    `${viewport.label}/Verify: destructive case deletion lacks confirmation`,
  );
  await page.getByTestId('ide-stimulus-cancel-delete').first().click();
  assert(
    (await target.locator('option').count()) === initialCount + 1,
    `${viewport.label}/Verify: canceling case deletion changed the testbench`,
  );
  await page.getByTestId(`ide-stimulus-delete-tick-${lastValue}`).first().click();
  await page.getByTestId(`ide-stimulus-confirm-delete-tick-${lastValue}`).first().click();
  assert(
    (await target.locator('option').count()) === initialCount,
    `${viewport.label}/Verify: confirmed case deletion did not remove one case`,
  );

  const selected = await target.inputValue();
  await page.getByTestId(`ide-stimulus-duplicate-tick-${selected}`).first().click();
  assert(
    (await target.locator('option').count()) === initialCount + 1,
    `${viewport.label}/Verify: Duplicate case did not create a case`,
  );
  const duplicateValue = await target.locator('option').last().getAttribute('value');
  assert(duplicateValue != null, `${viewport.label}/Verify: duplicated case has no tick identity`);
  await target.selectOption(duplicateValue);
  await page.getByTestId(`ide-stimulus-delete-tick-${duplicateValue}`).first().click();
  await page.getByTestId(`ide-stimulus-confirm-delete-tick-${duplicateValue}`).first().click();
  assert(
    (await target.locator('option').count()) === initialCount,
    `${viewport.label}/Verify: duplicate cleanup did not restore the case count`,
  );
}

async function collectSurfaceMetrics(page, viewport, mode) {
  await assertNoRootOverflow(page, `${viewport.label}/${mode}`);
  const metrics = await page.evaluate((activeMode) => {
    const surface = document.querySelector(`[data-testid="ide-mode-${activeMode}"]`);
    const visibleElement = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const primaries = surface
      ? Array.from(surface.querySelectorAll('.ide-button-primary, [data-product-priority="primary"]')).filter(visibleElement)
      : [];
    const routineControls = surface
      ? Array.from(surface.querySelectorAll('button.ide-button, a.ide-button')).filter(visibleElement)
      : [];
    const allControls = surface
      ? Array.from(surface.querySelectorAll('button, a[href], select, input:not([type="hidden"]), textarea')).filter((element) => {
          if (!visibleElement(element)) return false;
          // The timeline scrubber is a continuous instrument, not a routine press target.
          return !(element instanceof HTMLInputElement && element.type === 'range');
        })
      : [];
    const routineSmallest = routineControls
      .map((entry) => ({
        height: entry.getBoundingClientRect().height,
        className: typeof entry.className === 'string' ? entry.className : '',
        testId: entry.getAttribute('data-testid') ?? '',
        text: (entry.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }))
      .sort((left, right) => left.height - right.height)
      .slice(0, 5);
    const allControlSmallest = allControls
      .map((entry) => ({
        height: entry.getBoundingClientRect().height,
        className: typeof entry.className === 'string' ? entry.className : '',
        testId: entry.getAttribute('data-testid') ?? '',
        text: (entry.textContent ?? entry.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }))
      .sort((left, right) => left.height - right.height)
      .slice(0, 12);
    const narrativeText = surface
      ? Array.from(surface.querySelectorAll('p, li, td, th, dt, dd, label, small, span, strong, summary')).filter((element) => {
          if (!visibleElement(element)) return false;
          if (element.closest('[aria-hidden="true"], svg')) return false;
          return (element.textContent ?? '').replace(/\s+/g, ' ').trim().length > 0;
        })
      : [];
    const narrativeSmallest = narrativeText
      .map((entry) => ({
        fontSize: Number.parseFloat(getComputedStyle(entry).fontSize),
        tagName: entry.tagName.toLowerCase(),
        className: typeof entry.className === 'string' ? entry.className : '',
        testId: entry.getAttribute('data-testid') ?? '',
        parentClass: entry.parentElement && typeof entry.parentElement.className === 'string' ? entry.parentElement.className : '',
        parentTestId: entry.parentElement?.getAttribute('data-testid') ?? '',
        text: (entry.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }))
      .filter((entry) => Number.isFinite(entry.fontSize))
      .sort((left, right) => left.fontSize - right.fontSize)
      .slice(0, 5);
    const chips = surface
      ? Array.from(surface.querySelectorAll('.ide-status-pill, .ide-chip, [class*="-chip"]')).filter(visibleElement)
      : [];
    const bordered = surface
      ? Array.from(surface.querySelectorAll('.ide-panel, .ide-card, .ide-surface-panel, .ide-callout')).filter(visibleElement)
      : [];
    return {
      primaryCount: primaries.length,
      primaryLabels: primaries.map((entry) => entry.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      routineMinimum: routineControls.length
        ? Math.min(...routineControls.map((entry) => entry.getBoundingClientRect().height))
        : null,
      routineSmallest,
      allControlMinimum: allControls.length
        ? Math.min(...allControls.map((entry) => entry.getBoundingClientRect().height))
        : null,
      allControlSmallest,
      narrativeMinimum: narrativeText.length
        ? Math.min(...narrativeText.map((entry) => Number.parseFloat(getComputedStyle(entry).fontSize)).filter(Number.isFinite))
        : null,
      narrativeSmallest,
      bodyFont: surface ? Number.parseFloat(getComputedStyle(surface).fontSize) : 0,
      chipCount: chips.length,
      borderedSurfaceCount: bordered.length,
      visibleControlCount: allControls.length,
    };
  }, mode);

  return { mode, ...metrics };
}

function collectMetricFailures(records) {
  return records.flatMap((record) => record.surfaces.flatMap((metrics) => {
    const label = `${record.viewport.label}/${metrics.mode}`;
    const failures = [];
    if (metrics.primaryCount > 1) failures.push(`${label}: ${metrics.primaryCount} competing primary actions`);
    if (metrics.bodyFont < 14) failures.push(`${label}: body font is ${metrics.bodyFont}px`);
    if (metrics.routineMinimum != null && metrics.routineMinimum < 35.5) {
      failures.push(`${label}: routine control is ${metrics.routineMinimum}px tall (${JSON.stringify(metrics.routineSmallest)})`);
    }
    if (metrics.allControlMinimum != null && metrics.allControlMinimum < 35.5) {
      failures.push(`${label}: interactive control is ${metrics.allControlMinimum}px tall (${JSON.stringify(metrics.allControlSmallest)})`);
    }
    if (metrics.narrativeMinimum != null && metrics.narrativeMinimum < 12.5) {
      failures.push(`${label}: narrative text is ${metrics.narrativeMinimum}px (${JSON.stringify(metrics.narrativeSmallest)})`);
    }
    return failures;
  }));
}

async function selectAndGate(page) {
  const selectors = ['[data-node-id="and_node"]', '[data-testid="node-AND-and_node"]', '[data-testid^="node-AND-"]'];
  for (const selector of selectors) {
    const node = page.locator(selector).first();
    if (!(await visible(node))) continue;
    await node.click({ force: true });
    return;
  }
  throw new Error('Design did not expose a selectable AND gate');
}

async function readProjectSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const stable = (value) => {
      if (Array.isArray(value)) return value.map(stable);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        );
      }
      return value;
    };
    const stableSet = (entries) =>
      (entries ?? [])
        .map((entry) => stable(entry))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const circuit = state?.circuit ?? { nodes: [], connections: [] };
    const projectIoRows = stableSet(state?.projectIoRows);
    const semantic = stable({
      identity: {
        projectId: state?.projectId ?? null,
        projectName: state?.projectName ?? null,
        projectDescription: state?.projectDescription ?? null,
        projectKind: state?.projectKind ?? null,
        sourceExampleId: state?.sourceExampleId ?? null,
        activeExampleId: state?.activeExampleId ?? null,
        activeLabTaskId: state?.activeLabTaskId ?? null,
        scenarioAuthority: state?.scenarioAuthority ?? null,
        importMeta: state?.importMeta ?? null,
      },
      circuit: {
        nodes: stableSet(circuit.nodes),
        connections: stableSet(circuit.connections),
      },
      hardwareMappingV2: state?.hardwareMappingV2 ?? null,
      projectIoRows,
      projectVectors: state?.projectVectors ?? [],
      customVectors: state?.customVectors ?? [],
      scenarios: state?.scenarios ?? [],
      activeScenarioId: state?.activeScenarioId ?? null,
      verifyLastRun: state?.verifyLastRun ?? null,
      verifyRunHistory: state?.verifyRunHistory ?? [],
      projectHealthCore: state?.projectHealthCore ?? null,
    });
    return {
      semanticJson: JSON.stringify(semantic),
      projectId: state?.projectId ?? null,
      projectName: state?.projectName ?? null,
      projectKind: state?.projectKind ?? null,
      importMeta: state?.importMeta ?? null,
      nodes: circuit.nodes?.length ?? 0,
      nodeTypes: (circuit.nodes ?? []).map((node) => node.type ?? '').sort(),
      connections: circuit.connections?.length ?? 0,
      ioLabels: projectIoRows.map((row) => String(row.label ?? row.port ?? '')).filter(Boolean).sort(),
      vectorCount: state?.projectVectors?.length ?? 0,
      scenarioCount: state?.scenarios?.length ?? 0,
      verifyLastRunStatus: state?.verifyLastRun?.status ?? null,
      dirtySinceVerify: state?.projectHealthCore?.dirtySinceVerify ?? null,
    };
  });
}

function assertSameProjectSnapshot(expected, actual, label) {
  assert(actual.semanticJson === expected.semanticJson, `${label}: semantic project snapshot differs`);
}

async function buildValidImportFixture(filePath) {
  const timestamp = '2026-07-14T12:00:00.000Z';
  const hdlText = [
    'library IEEE;',
    'use IEEE.STD_LOGIC_1164.ALL;',
    'entity top is',
    '  port ( SW0 : in STD_LOGIC; SW1 : in STD_LOGIC; LD0 : out STD_LOGIC );',
    'end top;',
    'architecture Structural of top is',
    '  component AND2',
    '    port (A : in STD_LOGIC; B : in STD_LOGIC; Y : out STD_LOGIC);',
    '  end component;',
    'begin',
    '  U1 : AND2 port map (A => SW0, B => SW1, Y => LD0);',
    'end Structural;',
  ].join('\n');
  const xdcText = [
    'set_property PACKAGE_PIN V17 [get_ports {SW0}]',
    'set_property PACKAGE_PIN W16 [get_ports {SW1}]',
    'set_property PACKAGE_PIN U16 [get_ports {LD0}]',
  ].join('\n');
  const project = {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'Professional Workflow Recovery AND',
    description: 'Deterministic manifest fixture for the professional workflow recovery proof.',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', position: { x: 100, y: 140 }, label: 'SW0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', position: { x: 100, y: 280 }, label: 'SW1', config: {}, state: {} },
        { id: 'and_gate', type: 'AND', position: { x: 320, y: 200 }, label: 'AND', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', position: { x: 520, y: 200 }, label: 'LD0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and_gate', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and_gate', portName: 'b' } },
        { from: { nodeId: 'and_gate', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    hdl: { top: 'top', sources: [{ path: 'top.vhd', language: 'vhdl', text: hdlText }] },
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
      constraints: { type: 'xdc', text: xdcText },
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', pin: 'V17', label: 'SW0' },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', pin: 'W16', label: 'SW1' },
      ],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', pin: 'U16', label: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 1, inputs: { sw0_node: 0, sw1_node: 1 }, expected: { ld0_node: 0 } },
      { tick: 2, inputs: { sw0_node: 1, sw1_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 3, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 1 } },
    ],
    meta: {
      projectId: 'professional-workflow-recovery-and',
      projectKind: 'import',
      tags: ['classroom', 'professional-workflow-recovery'],
    },
  };
  const zip = new JSZip();
  const fixedDate = new Date(timestamp);
  zip.file('redbyte-project/project.rbproj.json', JSON.stringify(project, null, 2), { date: fixedDate });
  zip.file('redbyte-project/top.vhd', hdlText, { date: fixedDate });
  zip.file('redbyte-project/top.xdc', xdcText, { date: fixedDate });
  await writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE', platform: 'DOS' }));
}

async function pickExpectedCell(page) {
  const cells = await page.locator('[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const title = element.getAttribute('title') ?? '';
      return {
        testId: element.getAttribute('data-testid') ?? '',
        value: /:\s*1\s*-\s*drag/i.test(title) ? 1 : /:\s*0\s*-\s*drag/i.test(title) ? 0 : null,
      };
    }),
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1);
  assert(target?.testId, `Verify expected at least one authored expected-output cell: ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function setExpectedCell(page, testId, value) {
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const title = await cell.getAttribute('title');
    const current = /:\s*1\s*-\s*drag/i.test(title ?? '') ? 1 : /:\s*0\s*-\s*drag/i.test(title ?? '') ? 0 : null;
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(80);
  }
  throw new Error(`${testId} did not become ${value}`);
}

async function clickRunAwaitHash(page) {
  const previous = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunHistory?.length ?? 0,
  );
  await clickPreferredVerifyRun(page);
  await page.waitForFunction(
    (prior) => {
      const next = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunHistory?.length ?? 0;
      return next > prior;
    },
    previous,
    { timeout: 20000 },
  );
  await waitForVerifyResult(page, { timeout: 10000 });
}

async function clickPreferredVerifyRun(page) {
  for (const testId of [
    'ide-verify-stale-keep-reference',
    'ide-verify-primary-status-rerun',
    'ide-verify-primary-status-run-current',
    'ide-verify-primary-status-rerun-active',
  ]) {
    const staleAction = page.getByTestId(testId).first();
    if (!(await visible(staleAction))) continue;
    await staleAction.click();
    return;
  }
  await clickVerifyRun(page);
}

async function clickRunAwaitStatus(page) {
  await clickRunAwaitHash(page);
  return normalizedText(page.getByTestId('ide-verify-summary-status').first());
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (!(await visible(target))) continue;
    await target.scrollIntoViewIfNeeded().catch(() => null);
    await target.click();
    return;
  }
  throw new Error(`${label} was not visible. Tried ${selectors.join(', ')}`);
}

async function selectExportFileByName(page, name, label) {
  const browser = page.getByTestId('ide-export-file-browser').first();
  assert(await visible(browser), `${label}: generated package file browser is unavailable`);
  const file = browser.getByRole('button', { name }).first();
  assert(await visible(file), `${label}: ${name} is not available in the generated package file browser`);
  await file.click();
}

async function openModeByClick(page, mode, label) {
  const button = page.getByTestId(`mode-button-${mode}`).first();
  assert(await visible(button), `${label}: workflow navigation control is unavailable`);
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(120);
}

async function normalizedText(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function capture(page, viewport, phase) {
  await page.screenshot({
    path: resolve(EVIDENCE_ROOT, `${viewport.label}-${phase}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}
