#!/usr/bin/env node

import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
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
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', {
  paths: [path.join(process.cwd(), 'packages', 'rb-apps')],
}));

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'custom-clock-sequential-truth',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const DOWNLOAD_DIR = path.join(ARTIFACT_ROOT, 'downloads');

await mkdir(SCREENSHOT_DIR, { recursive: true });
await mkdir(DOWNLOAD_DIR, { recursive: true });

await runIdeGate('IDE custom clock sequential truth satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const records = [];
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      records.push(await runViewportScenario(page, baseUrl, viewport));
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
      await capture(page, viewport, 'failure').catch(() => null);
    }
  }

  await writeFile(
    path.join(ARTIFACT_ROOT, 'custom-clock-sequential-truth.json'),
    JSON.stringify({
      gate: 'ide-custom-clock-sequential-truth',
      generatedAtIso: new Date().toISOString(),
      records,
      browserProblems,
      failures,
    }, null, 2),
  );

  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Custom clock sequential truth failures:\n${failures.join('\n')}`);
});

async function runViewportScenario(page, baseUrl, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=custom-clock-sequential-truth-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}: startup`);
  await assertNoRootOverflow(page, `${viewport.label}: startup`);

  const record = {
    viewport: viewport.label,
    boardClockStarter: await proveBoardClockStarter(page, baseUrl, viewport),
    palette: await provePaletteClockVisibility(page, baseUrl, viewport),
    importedSimClock: await proveImportedSimClock(page, baseUrl, viewport),
    manualClock: await proveManualSwitchClock(page, baseUrl, viewport),
    customSequential: await proveCustomSequentialFromBlank(page, baseUrl, viewport),
  };
  await capture(page, viewport, 'complete');
  return record;
}

async function proveBoardClockStarter(page, baseUrl, viewport) {
  await openMode(page, baseUrl, 'project', `custom-clock-sequential-truth-${viewport.label}-starter-project`);
  await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
  await openMode(page, baseUrl, 'verify', `custom-clock-sequential-truth-${viewport.label}-starter-verify`);

  const clockText = await readText(page.getByTestId('ide-verify-clock-policy-panel').first());
  assert(/CLK100MHZ/i.test(clockText), `${viewport.label}: starter Verify must show CLK100MHZ`);
  assert(/W5/i.test(clockText), `${viewport.label}: starter Verify must show W5 board pin`);
  assert(/Auto board clock/i.test(clockText), `${viewport.label}: starter Verify must use auto board clock`);
  assert(await page.getByTestId('ide-stimulus-clock-row').count() === 0, `${viewport.label}: board clock must not render an editable clock stimulus row`);

  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: starter Compare mode must be selectable`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 30000 });
  const status = await readText(page.getByTestId('ide-verify-summary-status').first());
  assert(isVerifyPass(status), `${viewport.label}: two-bit-counter Verify should PASS, got "${status}"`);
  const policy = await readLastClockPolicy(page);
  assert(policy?.sourceType === 'board-clock', `${viewport.label}: starter run must record board-clock policy, got ${JSON.stringify(policy)}`);
  assert(policy?.packagePin === 'W5', `${viewport.label}: starter run must record W5 package pin`);

  await openMode(page, baseUrl, 'export', `custom-clock-sequential-truth-${viewport.label}-starter-export`);
  const exportText = await readText(page.getByTestId('ide-mode-export').first());
  assert(/E0/i.test(exportText), `${viewport.label}: starter Export must keep E0 boundary visible`);
  assert(
    /Vivado build, bitstream, programming, and physical board behavior remain external/i.test(exportText),
    `${viewport.label}: starter Export must not imply E1 is proven`,
  );
  await capture(page, viewport, 'starter-board-clock');

  return { status, policy };
}

async function provePaletteClockVisibility(page, baseUrl, viewport) {
  await openBlankDesign(page, baseUrl, viewport, 'palette');
  await revealDesignLibrary(page);
  const boardClock = page.getByTestId('ide-design-board-input-clk100mhz').first();
  assert(await visible(boardClock), `${viewport.label}: CLK100MHZ board resource must be visible in Design`);
  assert(await page.getByTestId('ide-design-palette-clock').count() === 0, `${viewport.label}: Sim Clock palette entry must not be visible`);
  const dockText = await readText(page.locator('[data-testid="ide-design-dock-palette"], [data-testid="ide-design-palette-dock"]').first());
  assert(/CLK100MHZ/i.test(dockText), `${viewport.label}: Design palette must name CLK100MHZ as the supported clock`);
  await capture(page, viewport, 'palette-clock-truth');
  return { boardClockVisible: true, simClockPaletteVisible: false };
}

async function proveImportedSimClock(page, baseUrl, viewport) {
  await loadProject(page, baseUrl, buildImportedSimClockDffProject(), 'verify', viewport, 'imported-sim-clock');
  const verifyText = await readText(page.getByTestId('ide-mode-verify').first());
  assert(/Sim Clock components are import-only/i.test(verifyText), `${viewport.label}: imported sim Clock must be labeled import-only in Verify`);
  assert(/Manual pulses/i.test(verifyText), `${viewport.label}: imported sim Clock must use manual-pulses mode`);
  assert(!/auto board clock source/i.test(verifyText), `${viewport.label}: imported sim Clock must not be described as board auto clock`);
  assert(await page.getByTestId('ide-stimulus-clock-row').count() > 0, `${viewport.label}: imported sim Clock must expose a manual clock row`);
  await capture(page, viewport, 'imported-sim-clock-verify');

  await openMode(page, baseUrl, 'export', `custom-clock-sequential-truth-${viewport.label}-imported-sim-clock-export`);
  const exportText = await readText(page.getByTestId('ide-mode-export').first());
  assert(/Sim Clock components are import-only/i.test(exportText), `${viewport.label}: Export must label sim Clock as import-only`);
  assert(/Replace the component with the CLK100MHZ board resource/i.test(exportText), `${viewport.label}: Export must give a CLK100MHZ migration path`);
  assert(!/add a Clock node/i.test(exportText), `${viewport.label}: Export must not tell students to add a Clock node`);
  await capture(page, viewport, 'imported-sim-clock-export');

  return {
    verifySummary: summarizeClockPanelText(verifyText),
    exportHasMigration: /CLK100MHZ/i.test(exportText),
  };
}

async function proveManualSwitchClock(page, baseUrl, viewport) {
  await loadProject(page, baseUrl, buildManualSwitchClockDffProject(), 'verify', viewport, 'manual-switch-clock');
  const verifyText = await readText(page.getByTestId('ide-mode-verify').first());
  assert(/Manual pulses/i.test(verifyText), `${viewport.label}: switch/button clock must use manual-pulses mode`);
  assert(!/Auto board clock/i.test(verifyText), `${viewport.label}: switch/button clock must not be auto board clock`);
  assert(/clock lane|manual pulses mode/i.test(verifyText), `${viewport.label}: switch/button clock must describe manual clock stimulus`);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: manual switch Compare mode must be selectable`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 30000 });
  const status = await readText(page.getByTestId('ide-verify-summary-status').first());
  assert(isVerifyPass(status), `${viewport.label}: default-manual switch-clock Compare should PASS, got "${status}"`);
  const policy = await readLastClockPolicy(page);
  assert(policy?.overrideMode === 'manual-pulses', `${viewport.label}: switch/button run must record manual-pulses policy, got ${JSON.stringify(policy)}`);
  assert(policy?.autoRunEnabled === false, `${viewport.label}: switch/button run must not auto-run clock`);
  assert(policy?.sourceType !== 'board-clock', `${viewport.label}: switch/button run must not record a board-clock source`);
  await capture(page, viewport, 'manual-switch-clock-verify');

  // This path deliberately never clicks a clock-mode control: detection must
  // make the manual source authoritative before Compare and keep it through Export.
  await openMode(page, baseUrl, 'export', `custom-clock-sequential-truth-${viewport.label}-manual-switch-export`);
  const zip = await downloadZip(page, viewport, 'manual-switch-clock');
  const testbench = readZipText(zip, /testbench\.vhd$/i);
  assert(/-- sequence=authored-vectors/i.test(testbench), `${viewport.label}: default-manual Export must declare authored vectors`);
  assert(!/clock_gen:\s*process/i.test(testbench), `${viewport.label}: default-manual Export must not invent a free-running clock`);
  assert(!/CLK_HALF_PERIOD/i.test(testbench), `${viewport.label}: default-manual Export must not emit an auto-clock period`);
  assert(!/wait until rising_edge/i.test(testbench), `${viewport.label}: default-manual Export must not wait on an independent edge`);
  const authoredClockValues = Array.from(
    // The fixture maps ENTER to Basys3 resource SW5. Generated testbenches use
    // the canonical artifact port, not the student-facing logical label.
    testbench.matchAll(/\bSW5(?:\(\d+\))?\s*<=\s*'([01])';/g),
    (match) => Number(match[1]),
  );
  assert(
    JSON.stringify(authoredClockValues) === JSON.stringify([0, 1, 0, 1]),
    `${viewport.label}: authored clock assignments must preserve vector order [0,1,0,1], got ${JSON.stringify(authoredClockValues)}`,
  );
  const vectorMarkers = [0, 1, 2, 3].map((tick) => testbench.indexOf(`tick=${tick}`));
  assert(
    vectorMarkers.every((offset, index) => offset >= 0 && (index === 0 || offset > vectorMarkers[index - 1])),
    `${viewport.label}: authored vector markers are missing or out of order: ${JSON.stringify(vectorMarkers)}`,
  );
  await capture(page, viewport, 'manual-switch-clock-export');
  return {
    status,
    manualClockVisible: true,
    manualWarningVisible: /Manual clock source/i.test(verifyText),
    policy,
    export: {
      zipPath: zip.zipPath,
      sequence: 'authored-vectors',
      authoredClockValues,
    },
  };
}

async function proveCustomSequentialFromBlank(page, baseUrl, viewport) {
  const project = buildBoardClockDffProject({
    name: 'Round 6 From Blank Board Clock DFF',
    projectId: `round6-from-blank-board-clock-dff-${viewport.label}`,
    projectKind: 'blank',
  });
  await loadProject(page, baseUrl, project, 'verify', viewport, 'custom-from-blank');

  const runtimeBefore = await readRuntimeSignature(page);
  assert(runtimeBefore.activeExampleId === null, `${viewport.label}: custom sequential fixture must not be a starter`);
  assert(runtimeBefore.sourceExampleId === null, `${viewport.label}: custom sequential fixture must have no starter sourceExampleId`);

  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: custom sequential Compare mode must be selectable`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 30000 });
  const status = await readText(page.getByTestId('ide-verify-summary-status').first());
  const run = await readLastRunSummary(page);
  assert(isVerifyPass(status), `${viewport.label}: custom sequential Verify should PASS, got "${status}" with ${JSON.stringify(run)}`);
  const policy = await readLastClockPolicy(page);
  assert(policy?.sourceType === 'board-clock', `${viewport.label}: custom sequential run must record board-clock policy`);
  assert(policy?.packagePin === 'W5', `${viewport.label}: custom sequential run must record W5 package pin`);

  await openMode(page, baseUrl, 'export', `custom-clock-sequential-truth-${viewport.label}-custom-export`);
  const zip = await downloadZip(page, viewport, 'custom-sequential');
  const xdc = readZipText(zip, /top\.xdc$/i);
  const testbench = readZipText(zip, /testbench\.vhd$/i);
  const readme = readZipText(zip, /README\.txt$/i);
  assert(/PACKAGE_PIN\s+W5/i.test(xdc), `${viewport.label}: custom sequential top.xdc must bind W5`);
  assert(/create_clock/i.test(xdc), `${viewport.label}: custom sequential top.xdc must emit a board-clock constraint`);
  assert(/wait until rising_edge\(CLK100MHZ\)/i.test(testbench), `${viewport.label}: testbench must synchronize on CLK100MHZ rising edges`);
  assert(/E0 package evidence only|Evidence level:\s*E0 export package only/i.test(readme), `${viewport.label}: README must keep E0 export boundary`);
  await capture(page, viewport, 'custom-sequential-export');

  return {
    status,
    policy,
    zipPath: zip.zipPath,
    rawHash: zip.rawHash,
    entries: zip.entries,
  };
}

async function openBlankDesign(page, baseUrl, viewport, label) {
  await openMode(page, baseUrl, 'project', `custom-clock-sequential-truth-${viewport.label}-${label}-project`);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    window.__RB_PROJECT_RUNTIME__?.getState?.()?.loadFromProject?.({
      kind: 'rb-project',
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: 'Round 6 Blank Clock Truth',
      description: 'Blank project for clock palette truth.',
      circuit: { nodes: [], connections: [] },
      ioMapping: { inputs: [], outputs: [] },
      vectors: [],
      macros: [],
      customComponents: [],
      meta: {
        projectId: 'round6-blank-clock-truth',
        projectKind: 'blank',
        sourceExampleId: null,
        activeExampleId: null,
      },
    });
    window.__RB_PROJECT_RUNTIME__?.getState?.()?.startBlankProject?.();
    window.__RB_CIRCUIT_STORE__?.getState?.()?.reset?.();
  });
  await openMode(page, baseUrl, 'design', `custom-clock-sequential-truth-${viewport.label}-${label}-design`);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

async function revealDesignLibrary(page) {
  const palette = page.locator('[data-testid="ide-design-dock-palette"]').first();
  if (await palette.isVisible().catch(() => false)) return;
  const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"], [data-testid="ide-design-library-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  await page.waitForSelector('[data-testid="ide-design-dock-palette"]', { timeout: 10000 });
}

async function loadProject(page, baseUrl, project, mode, viewport, label) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=custom-clock-sequential-truth-${viewport.label}-${label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.evaluate((nextProject) => {
    window.__RB_PROJECT_RUNTIME__?.getState?.()?.loadFromProject?.(nextProject);
  }, project);
  await page.waitForFunction(
    (expectedName) => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectName === expectedName,
    project.name,
    { timeout: 10000 },
  );
  await openMode(page, baseUrl, mode, `custom-clock-sequential-truth-${viewport.label}-${label}-${mode}`);
  await assertNoRootOverflow(page, `${viewport.label}: ${label} ${mode}`);
}

async function downloadZip(page, viewport, label) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    clickFirstVisible(page, [
      '[data-testid="ide-export-package-build-v1"]',
      '[data-testid="ide-export-package-download-v1"]',
      '[data-testid="ide-export-draft-download-v1"]',
    ], `${viewport.label}: ${label} export download`),
  ]);
  const failure = await download.failure();
  assert(!failure, `${viewport.label}: ${label} ZIP download failed: ${failure}`);
  const zipPath = path.join(DOWNLOAD_DIR, `${safeName(viewport.label)}-${label}.zip`);
  await download.saveAs(zipPath);
  return inspectZip(zipPath);
}

async function inspectZip(zipPath) {
  const bytes = await readFile(zipPath);
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .sort((left, right) => left.localeCompare(right));
  const texts = {};
  for (const entry of entries) {
    texts[entry] = await zip.file(entry).async('string');
  }
  return {
    zipPath,
    rawHash: crypto.createHash('sha256').update(bytes).digest('hex'),
    entries,
    texts,
  };
}

function readZipText(zipRecord, pattern) {
  const entry = zipRecord.entries.find((candidate) => pattern.test(candidate));
  assert(entry, `ZIP entry matching ${pattern} must exist`);
  return zipRecord.texts[entry];
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (!(await visible(target))) continue;
    await target.scrollIntoViewIfNeeded().catch(() => null);
    await target.click();
    return selector;
  }
  throw new Error(`${label} was not visible. Tried: ${selectors.join(', ')}`);
}

async function readText(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function readLastClockPolicy(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.clockPolicy ?? null);
}

async function readLastRunSummary(page) {
  return page.evaluate(() => {
    const run = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun;
    return {
      status: run?.status ?? null,
      runKind: run?.runKind ?? null,
      qualification: run?.qualification ?? null,
      clockPolicy: run?.clockPolicy ?? null,
      reportRows: (run?.report?.rows ?? []).slice(0, 10).map((row) => ({
        tick: row.tick,
        signal: row.signal,
        expected: row.expected,
        actual: row.actual,
        status: row.status,
      })),
      vectors: (run?.report?.vectors ?? []).slice(0, 8),
    };
  });
}

async function readRuntimeSignature(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    return {
      projectName: state?.projectName ?? null,
      activeExampleId: state?.activeExampleId ?? null,
      sourceExampleId: state?.activeExample?.id ?? state?.projectMeta?.sourceExampleId ?? state?.meta?.sourceExampleId ?? null,
      nodes: state?.circuit?.nodes?.length ?? 0,
      connections: state?.circuit?.connections?.length ?? 0,
      rows: (state?.projectIoRows ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        pin: row.pin,
        timingRole: row.timingRole,
      })),
    };
  });
}

async function capture(page, viewport, slug) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${safeName(viewport.label)}-${slug}.png`),
    fullPage: true,
  }).catch(() => null);
}

function summarizeClockPanelText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  const match = /(Sim Clock components are import-only.*?Export\.)/i.exec(text);
  return match?.[1] ?? text.slice(0, 240);
}

function buildBoardClockDffProject(options = {}) {
  const timestamp = '2026-06-29T12:00:00.000Z';
  const name = options.name ?? 'Round 6 Board Clock DFF';
  const projectId = options.projectId ?? 'round6-board-clock-dff';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name,
    description: 'Round 6 fixture: DFF clocked by the supported Basys3 CLK100MHZ board resource.',
    circuit: {
      nodes: [
        node('d_node', 'INPUT', 80, 140, 'D'),
        node('clk_node', 'INPUT', 80, 260, 'CLK100MHZ'),
        node('ff_node', 'DFlipFlop', 320, 200, 'FF0'),
        node('q_node', 'OUTPUT', 560, 200, 'Q'),
      ],
      connections: [
        wire('d_node', 'out', 'ff_node', 'D'),
        wire('clk_node', 'out', 'ff_node', 'CLK'),
        wire('ff_node', 'Q', 'q_node', 'in'),
      ],
    },
    ioMapping: {
      inputs: [
        input('d', 'd_node', 'D', 'SW0', { boardResourceType: 'switch' }),
        input('clk', 'clk_node', 'CLK100MHZ', 'CLK100MHZ', {
          timingRole: 'clock',
          boardResourceType: 'clock_pin',
        }),
      ],
      outputs: [
        output('q', 'q_node', 'Q', 'LD0', { boardResourceType: 'led' }),
      ],
    },
    vectors: [
      vector(0, { d: 1 }, { q: 1 }),
      vector(1, { d: 1 }, { q: 1 }),
      vector(2, { d: 0 }, { q: 0 }),
      vector(3, { d: 0 }, { q: 0 }),
    ],
    meta: {
      projectId,
      projectKind: options.projectKind ?? 'authored',
      sourceExampleId: null,
      activeExampleId: null,
      tags: ['round6', 'custom-clock-sequential-truth'],
    },
  };
}

function buildImportedSimClockDffProject() {
  const timestamp = '2026-06-29T12:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'Round 6 Imported Sim Clock DFF',
    description: 'Round 6 fixture: legacy imported DFF with a sim-only Clock component.',
    circuit: {
      nodes: [
        {
          id: 'clk_node',
          type: 'Clock',
          label: 'CLK',
          x: 80,
          y: 120,
          position: { x: 80, y: 120 },
          rotation: 0,
          config: { role: 'sim', period: 2 },
          state: {},
        },
        node('d_node', 'INPUT', 80, 260, 'D'),
        node('ff_node', 'DFlipFlop', 320, 200, 'FF0'),
        node('q_node', 'OUTPUT', 560, 200, 'Q'),
      ],
      connections: [
        wire('clk_node', 'out', 'ff_node', 'CLK'),
        wire('d_node', 'out', 'ff_node', 'D'),
        wire('ff_node', 'Q', 'q_node', 'in'),
      ],
    },
    ioMapping: {
      inputs: [
        input('clk', 'clk_node', 'CLK100MHZ', 'CLK100MHZ', {
          timingRole: 'clock',
          boardResourceType: 'clock_pin',
        }),
        input('d', 'd_node', 'D', 'SW0', { boardResourceType: 'switch' }),
      ],
      outputs: [
        output('q', 'q_node', 'Q', 'LD0', { boardResourceType: 'led' }),
      ],
    },
    vectors: [
      vector(0, { d: 1 }, { q: 0 }),
    ],
    meta: {
      projectId: 'round6-imported-sim-clock-dff',
      projectKind: 'import',
      sourceExampleId: null,
      tags: ['round6', 'sim-clock-import'],
    },
  };
}

function buildManualSwitchClockDffProject() {
  const timestamp = '2026-06-29T12:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'Round 6 Manual Switch Clock DFF',
    description: 'Round 6 fixture: DFF clocked by a deliberate manual switch lane.',
    circuit: {
      nodes: [
        node('d_node', 'INPUT', 80, 140, 'D'),
        node('enter_node', 'INPUT', 80, 260, 'ENTER (SW5)'),
        node('ff_node', 'DFlipFlop', 320, 200, 'FF0'),
        node('q_node', 'OUTPUT', 560, 200, 'Q'),
      ],
      connections: [
        wire('d_node', 'out', 'ff_node', 'D'),
        wire('enter_node', 'out', 'ff_node', 'CLK'),
        wire('ff_node', 'Q', 'q_node', 'in'),
      ],
    },
    ioMapping: {
      inputs: [
        input('d', 'd_node', 'D', 'SW0', { boardResourceType: 'switch' }),
        input('enter', 'enter_node', 'ENTER (SW5)', 'SW5', {
          timingRole: 'manual_step',
          boardResourceType: 'switch',
        }),
      ],
      outputs: [
        output('q', 'q_node', 'Q', 'LD0', { boardResourceType: 'led' }),
      ],
    },
    vectors: [
      { tick: 0, inputs: { d: 1, enter: 0 }, expected: { q: 0 } },
      { tick: 1, inputs: { d: 1, enter: 1 }, expected: { q: 1 } },
      { tick: 2, inputs: { d: 0, enter: 0 }, expected: { q: 1 } },
      { tick: 3, inputs: { d: 0, enter: 1 }, expected: { q: 0 } },
    ],
    meta: {
      projectId: 'round6-manual-switch-clock-dff',
      projectKind: 'authored',
      sourceExampleId: null,
      tags: ['round6', 'manual-clock'],
    },
  };
}

function node(id, type, x, y, label) {
  return { id, type, label, x, y, position: { x, y }, rotation: 0, config: {}, state: {} };
}

function wire(fromNode, fromPort, toNode, toPort) {
  return {
    id: `wire-${fromNode}-${fromPort}-${toNode}-${toPort}`,
    from: { nodeId: fromNode, portName: fromPort },
    to: { nodeId: toNode, portName: toPort },
  };
}

function input(id, nodeId, label, pin, extra = {}) {
  return { id, nodeId, port: 'out', label, pin, required: true, ...extra };
}

function output(id, nodeId, label, pin, extra = {}) {
  return { id, nodeId, port: 'in', label, pin, required: true, ...extra };
}

function vector(tick, inputs, expected) {
  return { id: `vec-${String(tick).padStart(2, '0')}`, tick, inputs, expected };
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-');
}
