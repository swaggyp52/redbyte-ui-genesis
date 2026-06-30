#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', {
  paths: [path.join(process.cwd(), 'packages', 'rb-apps')],
}));

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'build-fresh-after-import-replacement',
);
const FIXTURE_DIR = path.join(ARTIFACT_ROOT, 'fixtures');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const TARGET_NAME = 'RB Build Fresh After Import Target';

await mkdir(FIXTURE_DIR, { recursive: true });
await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE Build Fresh after import replacement satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installOnboardingSeenContext(page);

  const fixtures = await buildFixtures();
  const records = [];
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      records.push(await runViewportScenario(page, baseUrl, viewport, fixtures));
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
      await capture(page, viewport, 'failure').catch(() => null);
    }
  }

  await writeFile(
    path.join(ARTIFACT_ROOT, 'build-fresh-after-import-replacement.json'),
    JSON.stringify({
      gate: 'ide-build-fresh-after-import-replacement',
      generatedAtIso: new Date().toISOString(),
      records,
      browserProblems,
      failures,
    }, null, 2),
  );

  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Build Fresh after import replacement failures:\n${failures.join('\n')}`);
});

async function runViewportScenario(page, baseUrl, viewport, fixtures) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await clearStudentStorageForViewport(page, baseUrl, viewport);
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=build-fresh-after-import-replacement-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}: startup`);
  await assertNoRootOverflow(page, `${viewport.label}: startup`);

  await openImportFromProject(page, baseUrl, viewport);
  await ensureUploadStage(page);
  await uploadZip(page, fixtures.simClockZip);
  await page.locator('[data-testid="ide-import-zip-inspection"]').waitFor({ state: 'visible', timeout: 30000 });
  const authorityText = await readText(page.locator('[data-testid="ide-import-zip-authority"]').first());
  assert(
    /embedded manifest|one source of truth/i.test(authorityText),
    `${viewport.label}: imported fixture must use the embedded RedByte manifest`,
  );

  await processImport(page);
  await page.locator('[data-testid="ide-import-commit-preview"]').waitFor({ state: 'visible', timeout: 30000 });
  await capture(page, viewport, 'import-review');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid="ide-import-apply-confirm"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 30000 });
  await page.waitForFunction(
    (expectedName) => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectName === expectedName,
    fixtures.projectName,
    { timeout: 10000 },
  );

  const imported = await readRuntimeSignature(page);
  assertImportedState(imported, viewport, fixtures.projectName);
  await waitForPersistedRuntime(page, imported, `${viewport.label}: imported project persisted before cancel`);
  await capture(page, viewport, 'applied-import-design');

  await openMode(page, baseUrl, 'project', `build-fresh-after-import-replacement-${viewport.label}-cancel`);
  await page.once('dialog', async (dialog) => {
    assert(/fresh blank project|replaced/i.test(dialog.message()), `${viewport.label}: cancel dialog copy must describe replacement`);
    await dialog.dismiss();
  });
  await clickBuildFresh(page, viewport, 'cancel Build Fresh');
  await page.waitForTimeout(300);
  const afterCancel = await readRuntimeSignature(page);
  assertSameProject(imported, afterCancel, `${viewport.label}: cancel must preserve imported work`);
  await waitForPersistedRuntime(page, afterCancel, `${viewport.label}: cancel persisted before reload`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  const afterCancelReload = await readRuntimeSignature(page);
  assertSameProject(imported, afterCancelReload, `${viewport.label}: cancel reload must preserve imported work`, {
    requireImportMeta: false,
  });
  await capture(page, viewport, 'cancel-preserved-import');

  await page.once('dialog', async (dialog) => {
    assert(/fresh blank project|replaced/i.test(dialog.message()), `${viewport.label}: confirm dialog copy must describe replacement`);
    await dialog.accept();
  });
  await clickBuildFresh(page, viewport, 'confirm Build Fresh');
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  const targetEmpty = await readRuntimeSignature(page);
  assertFreshEmptyTarget(targetEmpty, imported, `${viewport.label}: confirmed Build Fresh`);
  assertNoImportUrlState(targetEmpty, `${viewport.label}: confirmed Build Fresh`);

  await renameProject(page, TARGET_NAME, viewport);
  const renamedTarget = await readRuntimeSignature(page);
  assertFreshEmptyTarget(renamedTarget, imported, `${viewport.label}: confirmed Build Fresh renamed target`, {
    expectedProjectName: TARGET_NAME,
  });
  await waitForPersistedRuntime(page, renamedTarget, `${viewport.label}: empty target persisted before reload`);
  await capture(page, viewport, 'confirmed-empty-target');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const targetAfterEmptyReload = await readRuntimeSignature(page);
  assertFreshEmptyTarget(targetAfterEmptyReload, imported, `${viewport.label}: confirmed Build Fresh reload`, {
    expectedProjectName: TARGET_NAME,
  });
  assertNoImportUrlState(targetAfterEmptyReload, `${viewport.label}: confirmed Build Fresh reload`);
  await assertNoOldStateAcrossSurfaces(page, baseUrl, viewport, imported);

  await openMode(page, baseUrl, 'design', `build-fresh-after-import-replacement-${viewport.label}-target-place-sw0`);
  await revealDesignLibrary(page);
  const replacementSw0NodeId = await placeFromPalette(page, '[data-testid="ide-design-board-input-sw0"]', { x: 0.30, y: 0.40 });
  const targetWithNewSw0 = await readRuntimeSignature(page);
  assert(targetWithNewSw0.nodes === 1, `${viewport.label}: target should allow exactly one new SW0 node, got ${targetWithNewSw0.nodes}`);
  assert(targetWithNewSw0.nodeIds.includes(replacementSw0NodeId), `${viewport.label}: replacement SW0 node must be in target project`);
  assert(!targetWithNewSw0.nodeIds.some((id) => imported.nodeIds.includes(id)), `${viewport.label}: old imported node ids returned after placing SW0`);
  assert(targetWithNewSw0.rows.length === 1, `${viewport.label}: replacement SW0 should create one IO row, got ${targetWithNewSw0.rows.length}`);
  await waitForPersistedRuntime(page, targetWithNewSw0, `${viewport.label}: target SW0 persisted before reload`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const targetAfterSw0Reload = await readRuntimeSignature(page);
  assert(targetAfterSw0Reload.projectName === TARGET_NAME, `${viewport.label}: target title must persist`);
  assert(targetAfterSw0Reload.nodes === 1, `${viewport.label}: target SW0 reload must keep one new node`);
  assert(!targetAfterSw0Reload.nodeIds.some((id) => imported.nodeIds.includes(id)), `${viewport.label}: old imported graph returned after reload`);
  await capture(page, viewport, 'target-new-sw0-reload');

  return {
    viewport: viewport.label,
    imported,
    afterCancel,
    afterCancelReload,
    targetEmpty,
    renamedTarget,
    targetAfterEmptyReload,
    targetAfterSw0Reload,
  };
}

async function assertNoOldStateAcrossSurfaces(page, baseUrl, viewport, imported) {
  const surfaceRecords = {};
  for (const mode of ['project', 'verify', 'hardware', 'export', 'import']) {
    await openMode(page, baseUrl, mode, `build-fresh-after-import-replacement-${viewport.label}-${mode}`);
    await assertNoRootOverflow(page, `${viewport.label}: ${mode}`);
    const signature = await readRuntimeSignature(page);
    surfaceRecords[mode] = signature;
    assert(signature.projectName === TARGET_NAME, `${viewport.label}: ${mode} must keep target identity`);
    assert(signature.projectKind === 'blank', `${viewport.label}: ${mode} must stay blank after replacement`);
    assert(signature.importMeta === null, `${viewport.label}: ${mode} leaked import metadata`);
    assert(!signature.nodeIds.some((id) => imported.nodeIds.includes(id)), `${viewport.label}: ${mode} leaked imported node ids`);
    assert(!signature.rows.some((row) => imported.rows.some((oldRow) => oldRow.id === row.id && oldRow.nodeId === row.nodeId)), `${viewport.label}: ${mode} leaked imported IO rows`);
    assert(signature.hardwareEntries === 0 || signature.nodes > 0, `${viewport.label}: ${mode} leaked hardware mapping without a new graph`);
    assertNoImportUrlState(signature, `${viewport.label}: ${mode}`);
    if (mode === 'verify' || mode === 'hardware' || mode === 'export') {
      assert(signature.verifyLastRunStatus === null, `${viewport.label}: ${mode} must not keep imported Verify proof`);
      assert(signature.lastExportStatus === null, `${viewport.label}: ${mode} must not keep imported Export package state`);
    }
    if (mode === 'import') {
      assert(await visible(page.locator('[data-testid="ide-mode-import"]').first()), `${viewport.label}: Import utility must remain available`);
    }
  }
  await writeFile(
    path.join(ARTIFACT_ROOT, `cross-surface-${safeName(viewport.label)}.json`),
    JSON.stringify(surfaceRecords, null, 2),
  );
}

async function openImportFromProject(page, baseUrl, viewport) {
  await openMode(page, baseUrl, 'project', `build-fresh-after-import-replacement-${viewport.label}-project`);
  const importPath = page.locator('[data-testid="ide-project-path-import-recover"]').first();
  if (await visible(importPath)) {
    await importPath.click();
  } else {
    const importPrimary = page.locator('[data-testid="ide-project-import-primary"]').first();
    if (await visible(importPrimary)) {
      await importPrimary.click();
    } else {
      await openMode(page, baseUrl, 'import', `build-fresh-after-import-replacement-${viewport.label}-import`);
      return;
    }
  }
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
}

async function ensureUploadStage(page) {
  const uploadTab = page.locator('[data-testid="ide-import-tab-upload"]').first();
  if (await visible(uploadTab)) {
    await uploadTab.click();
  }
}

async function uploadZip(page, filePath) {
  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles(filePath);
}

async function processImport(page) {
  await clickFirstVisible(page, [
    '[data-testid="ide-import-process-design"]',
  ], 'Review Import');
}

async function clickBuildFresh(page, viewport, label) {
  const selectors = [
    '[data-testid="ide-project-build-fresh-primary"]',
    '[data-testid="ide-project-path-build-fresh"]',
  ];
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (await target.isVisible().catch(() => false)) {
      await target.scrollIntoViewIfNeeded().catch(() => null);
      await target.click();
      return selector;
    }
  }
  throw new Error(`${viewport.label}: ${label} button was not visible`);
}

async function installOnboardingSeenContext(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    } catch {
      // Storage can be unavailable on intermediate browser documents.
    }
  });
}

async function clearStudentStorageForViewport(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?e2e=1&gate=build-fresh-after-import-replacement-${viewport.label}-storage-reset`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    } catch {
      // Storage can be unavailable in unusual browser contexts.
    }
    try {
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable in unusual browser contexts.
    }
  });
}

async function renameProject(page, name, viewport) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await title.isVisible().catch(() => false), `${viewport.label}: topbar project title must be visible`);
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
  await page.waitForFunction(
    (expected) => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectName === expected,
    name,
    { timeout: 5000 },
  );
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

async function placeFromPalette(page, selector, position) {
  await revealDesignLibrary(page);
  const before = await readRuntimeSignature(page);
  const button = page.locator(selector).first();
  assert(await button.isVisible().catch(() => false), `palette entry ${selector} must be visible`);
  assert(!(await button.isDisabled().catch(() => false)), `palette entry ${selector} must be enabled`);
  await button.scrollIntoViewIfNeeded().catch(() => null);
  await button.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1',
    { timeout: 5000 },
  );
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), `design canvas bounds unavailable for placement from ${selector}`);
  await page.mouse.click(bounds.x + bounds.width * position.x, bounds.y + bounds.height * position.y);
  await page.waitForFunction(
    (knownIds) => {
      const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
      return nodes.some((node) => !knownIds.includes(node.id));
    },
    before.nodeIds,
    { timeout: 8000 },
  );
  const after = await readRuntimeSignature(page);
  const added = after.nodeIds.filter((id) => !before.nodeIds.includes(id));
  assert(added.length >= 1, `placing ${selector} did not add a node`);
  return added.at(-1);
}

async function readRuntimeSignature(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const circuit = state?.circuit ?? { nodes: [], connections: [] };
    const rows = (state?.projectIoRows ?? []).map((row) => ({
      id: row.id ?? '',
      nodeId: row.nodeId ?? '',
      label: row.label ?? '',
      pin: row.pin ?? '',
      direction: row.direction ?? '',
      timingRole: row.timingRole ?? null,
      mappingKind: row.mappingKind ?? null,
    })).sort((left, right) => `${left.id}:${left.nodeId}`.localeCompare(`${right.id}:${right.nodeId}`));
    return {
      projectId: state?.projectId ?? null,
      projectName: state?.projectName ?? null,
      projectKind: state?.projectKind ?? null,
      sourceExampleId: state?.sourceExampleId ?? null,
      activeExampleId: state?.activeExampleId ?? null,
      importMeta: state?.importMeta ?? null,
      nodes: circuit.nodes?.length ?? 0,
      nodeIds: (circuit.nodes ?? []).map((node) => node.id).sort(),
      nodeLabels: (circuit.nodes ?? []).map((node) => node.label ?? '').filter(Boolean).sort(),
      connections: circuit.connections?.length ?? 0,
      rows,
      hardwareEntries: state?.hardwareMappingV2?.entries?.length ?? 0,
      projectVectors: state?.projectVectors?.length ?? 0,
      customVectors: state?.customVectors?.length ?? 0,
      scenarios: state?.scenarios?.length ?? 0,
      verifyRunHistory: state?.verifyRunHistory?.length ?? 0,
      verifyLastRunStatus: state?.verifyLastRun?.status ?? null,
      lastVerifyStatus: state?.projectHealthCore?.lastVerify?.status ?? null,
      lastExportStatus: state?.projectHealthCore?.lastExport?.status ?? null,
      dirtySinceVerify: state?.projectHealthCore?.dirtySinceVerify ?? null,
      dirtySinceExport: state?.projectHealthCore?.dirtySinceExport ?? null,
      locationHref: window.location.href,
    };
  });
}

async function waitForPersistedRuntime(page, expected, label) {
  await page.waitForFunction(
    ({ projectName, nodes, rows }) => {
      try {
        const raw = localStorage.getItem('rb.ide.project-runtime.v1');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const state = parsed?.state;
        return (
          state?.projectName === projectName &&
          (state?.circuit?.nodes?.length ?? 0) === nodes &&
          (state?.projectIoRows?.length ?? 0) === rows
        );
      } catch {
        return false;
      }
    },
    { projectName: expected.projectName, nodes: expected.nodes, rows: expected.rows.length },
    { timeout: 5000 },
  ).catch(() => {
    throw new Error(`${label}: persisted runtime snapshot did not settle`);
  });
}

function assertImportedState(actual, viewport, projectName) {
  assert(actual.projectName === projectName, `${viewport.label}: imported project name missing, got ${actual.projectName}`);
  assert(actual.projectKind === 'import', `${viewport.label}: project kind must be import, got ${actual.projectKind}`);
  assert(actual.importMeta !== null, `${viewport.label}: import metadata must be present after Apply`);
  assert(actual.nodes === 4, `${viewport.label}: imported project must have 4 nodes, got ${actual.nodes}`);
  assert(actual.connections === 3, `${viewport.label}: imported project must have 3 wires, got ${actual.connections}`);
  assert(actual.rows.length === 3, `${viewport.label}: imported project must have 3 IO rows, got ${actual.rows.length}`);
  assert(actual.hardwareEntries >= 3, `${viewport.label}: imported project must have hardware mapping entries, got ${actual.hardwareEntries}`);
  assert(actual.nodeIds.includes('clk_node'), `${viewport.label}: imported clock node missing`);
  assert(actual.nodeIds.includes('ff_node'), `${viewport.label}: imported DFF node missing`);
  assert(actual.rows.some((row) => row.label === 'CLK' && row.pin === 'CLK100MHZ'), `${viewport.label}: imported CLK row missing`);
  assert(actual.rows.some((row) => row.label === 'D' && row.pin === 'SW0'), `${viewport.label}: imported D row missing`);
  assert(actual.rows.some((row) => row.label === 'Q' && row.pin === 'LD0'), `${viewport.label}: imported Q row missing`);
}

function assertSameProject(expected, actual, label, options = {}) {
  assert(actual.projectId === expected.projectId, `${label}: project id changed`);
  assert(actual.projectName === expected.projectName, `${label}: project name changed`);
  assert(actual.projectKind === expected.projectKind, `${label}: project kind changed`);
  if (options.requireImportMeta !== false) {
    assert(actual.importMeta !== null, `${label}: import metadata disappeared`);
  }
  assert(actual.nodes === expected.nodes, `${label}: node count changed ${expected.nodes} -> ${actual.nodes}`);
  assert(actual.connections === expected.connections, `${label}: connection count changed`);
  assert(JSON.stringify(actual.nodeIds) === JSON.stringify(expected.nodeIds), `${label}: node ids changed`);
  assert(JSON.stringify(actual.rows) === JSON.stringify(expected.rows), `${label}: IO rows changed`);
  assert(actual.hardwareEntries === expected.hardwareEntries, `${label}: hardware mapping count changed`);
}

function assertFreshEmptyTarget(actual, imported, label, options = {}) {
  if (options.expectedProjectName) {
    assert(actual.projectName === options.expectedProjectName, `${label}: target name missing, got ${actual.projectName}`);
  } else {
    assert(actual.projectName !== imported.projectName, `${label}: imported project identity survived replacement`);
  }
  assert(actual.projectKind === 'blank', `${label}: target must be a blank project, got ${actual.projectKind}`);
  assert(actual.sourceExampleId === null, `${label}: source example must be cleared`);
  assert(actual.activeExampleId === null, `${label}: active example must be cleared`);
  assert(actual.importMeta === null, `${label}: import metadata must be cleared`);
  assert(actual.nodes === 0, `${label}: target must have zero nodes, got ${actual.nodes}`);
  assert(actual.connections === 0, `${label}: target must have zero wires, got ${actual.connections}`);
  assert(actual.rows.length === 0, `${label}: target must have zero IO rows, got ${actual.rows.length}`);
  assert(actual.projectId !== imported.projectId, `${label}: replacement must create a new project id`);
  assert(!actual.nodeIds.some((id) => imported.nodeIds.includes(id)), `${label}: imported node ids survived replacement`);
  assert(actual.hardwareEntries === 0, `${label}: target must clear hardwareMappingV2 entries, got ${actual.hardwareEntries}`);
  assert(actual.projectVectors === 0, `${label}: target must clear project vectors, got ${actual.projectVectors}`);
  assert(actual.customVectors === 0, `${label}: target must clear custom vectors, got ${actual.customVectors}`);
  assert(actual.verifyRunHistory === 0, `${label}: target must clear verify run history, got ${actual.verifyRunHistory}`);
  assert(actual.verifyLastRunStatus === null, `${label}: target must clear verifyLastRun`);
  assert(actual.lastVerifyStatus === null, `${label}: target must clear projectHealth lastVerify`);
  assert(actual.lastExportStatus === null, `${label}: target must clear projectHealth lastExport`);
}

function assertNoImportUrlState(signature, label) {
  const href = signature.locationHref ?? '';
  assert(!href.includes('importActive=1'), `${label}: stale importActive URL state survived in ${href}`);
  assert(!href.includes('importSource='), `${label}: stale importSource URL state survived in ${href}`);
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

async function capture(page, viewport, slug) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${safeName(viewport.label)}-${slug}.png`),
    fullPage: true,
  }).catch(() => null);
}

async function buildFixtures() {
  const project = buildImportedSimClockDffProject();
  const simClockZip = path.join(FIXTURE_DIR, 'round12-sim-clock-import.zip');
  const zip = new JSZip();
  const fixedDate = new Date('2026-01-01T00:00:00.000Z');
  zip.file('redbyte-project/project.rbproj.json', JSON.stringify(project, null, 2), { date: fixedDate });
  zip.file('redbyte-project/README.txt', 'Round 12 Build Fresh after Import replacement fixture. E0 browser import fixture only.', { date: fixedDate });
  await writeFile(simClockZip, await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
    platform: 'DOS',
  }));
  return { simClockZip, projectName: project.name };
}

function buildImportedSimClockDffProject() {
  const timestamp = '2026-06-30T12:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'Round 12 Imported Sim Clock DFF',
    description: 'Round 12 fixture: applied import with a sim-only Clock component.',
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
      projectId: 'round12-imported-sim-clock-dff',
      projectKind: 'import',
      sourceExampleId: null,
      scenarioAuthority: 'authored',
      tags: ['round12', 'build-fresh-after-import', 'sim-clock-import'],
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
