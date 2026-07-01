#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, assertBuildFreshReplacementDialog, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'build-fresh-replacement-integrity',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE Build Fresh replacement integrity satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installOnboardingSeenContext(page);

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
    path.join(ARTIFACT_ROOT, 'build-fresh-replacement-integrity.json'),
    JSON.stringify({
      gate: 'ide-build-fresh-replacement-integrity',
      generatedAtIso: new Date().toISOString(),
      records,
      browserProblems,
      failures,
    }, null, 2),
  );

  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Build Fresh replacement failures:\n${failures.join('\n')}`);
});

async function runViewportScenario(page, baseUrl, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await clearStudentStorageForViewport(page, baseUrl, viewport);
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=build-fresh-replacement-integrity-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}: startup`);
  await assertNoRootOverflow(page, `${viewport.label}: startup`);

  await clickBuildFresh(page, viewport, 'initial Build Fresh');
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await renameProject(page, 'RB Build Fresh Replacement Source', viewport);
  await revealDesignLibrary(page);
  const sourceSw0NodeId = await placeFromPalette(page, '[data-testid="ide-design-board-input-sw0"]', { x: 0.22, y: 0.34 });
  const sourceLd0NodeId = await placeFromPalette(page, '[data-testid="ide-design-board-output-ld0"]', { x: 0.68, y: 0.44 });
  const source = await readRuntimeSignature(page);
  assert(source.nodes >= 2, `${viewport.label}: source project must have placed nodes`);
  assert(source.rows.some((row) => row.label === 'SW0' || row.pin === 'SW0'), `${viewport.label}: source project must expose SW0 row`);
  assert(source.rows.some((row) => row.label === 'LD0' || row.pin === 'LD0'), `${viewport.label}: source project must expose LD0 row`);
  await waitForPersistedRuntime(page, source, `${viewport.label}: source persisted before cancel`);
  await capture(page, viewport, 'source-design-with-work');

  await openMode(page, baseUrl, 'project', `build-fresh-replacement-integrity-${viewport.label}-cancel`);
  let cancelDialogMessage = '';
  await page.once('dialog', async (dialog) => {
    cancelDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await clickBuildFresh(page, viewport, 'cancel Build Fresh');
  await page.waitForTimeout(300);
  assertBuildFreshReplacementDialog(cancelDialogMessage, `${viewport.label}: cancel Build Fresh`);
  const afterCancel = await readRuntimeSignature(page);
  assertSameProject(source, afterCancel, `${viewport.label}: cancel must preserve old work`);
  await waitForPersistedRuntime(page, afterCancel, `${viewport.label}: cancel persisted before reload`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  const afterCancelReload = await readRuntimeSignature(page);
  assertSameProject(source, afterCancelReload, `${viewport.label}: cancel reload must preserve old work`, {
    compareProjectId: false,
    compareProjectName: false,
    compareProjectKind: false,
  });
  await capture(page, viewport, 'cancel-preserved-source');

  let confirmDialogMessage = '';
  await page.once('dialog', async (dialog) => {
    confirmDialogMessage = dialog.message();
    await dialog.accept();
  });
  await clickBuildFresh(page, viewport, 'confirm Build Fresh');
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  assertBuildFreshReplacementDialog(confirmDialogMessage, `${viewport.label}: confirm Build Fresh`);
  await renameProject(page, 'RB Build Fresh Replacement Target', viewport);
  const targetEmpty = await readRuntimeSignature(page);
  assertFreshEmptyTarget(targetEmpty, source, `${viewport.label}: confirmed Build Fresh`);
  assert(!targetEmpty.nodeIds.includes(sourceSw0NodeId), `${viewport.label}: old SW0 node id survived replacement`);
  assert(!targetEmpty.nodeIds.includes(sourceLd0NodeId), `${viewport.label}: old LD0 node id survived replacement`);
  await waitForPersistedRuntime(page, targetEmpty, `${viewport.label}: empty target persisted before reload`);
  await capture(page, viewport, 'confirmed-empty-target');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const targetAfterEmptyReload = await readRuntimeSignature(page);
  assertFreshEmptyTarget(targetAfterEmptyReload, source, `${viewport.label}: confirmed Build Fresh reload`);
  await assertNoOldStateAcrossSurfaces(page, baseUrl, viewport, source);

  await openMode(page, baseUrl, 'design', `build-fresh-replacement-integrity-${viewport.label}-target-place-sw0`);
  await revealDesignLibrary(page);
  const replacementSw0NodeId = await placeFromPalette(page, '[data-testid="ide-design-board-input-sw0"]', { x: 0.30, y: 0.40 });
  const targetWithNewSw0 = await readRuntimeSignature(page);
  assert(targetWithNewSw0.nodes === 1, `${viewport.label}: target should allow exactly one new SW0 node, got ${targetWithNewSw0.nodes}`);
  assert(targetWithNewSw0.nodeIds.includes(replacementSw0NodeId), `${viewport.label}: replacement SW0 node must be in target project`);
  assert(targetWithNewSw0.rows.length === 1, `${viewport.label}: replacement SW0 should create one IO row, got ${targetWithNewSw0.rows.length}`);
  await waitForPersistedRuntime(page, targetWithNewSw0, `${viewport.label}: target SW0 persisted before reload`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const targetAfterSw0Reload = await readRuntimeSignature(page);
  assert(targetAfterSw0Reload.projectName === 'RB Build Fresh Replacement Target', `${viewport.label}: target title must persist`);
  assert(targetAfterSw0Reload.nodes === 1, `${viewport.label}: target SW0 reload must keep one new node`);
  await capture(page, viewport, 'target-new-sw0-reload');

  return {
    viewport: viewport.label,
    source,
    afterCancel,
    afterCancelReload,
    targetEmpty,
    targetAfterEmptyReload,
    targetAfterSw0Reload,
  };
}

async function assertNoOldStateAcrossSurfaces(page, baseUrl, viewport, source) {
  const surfaceRecords = {};
  for (const mode of ['project', 'verify', 'hardware', 'export', 'import']) {
    await openMode(page, baseUrl, mode, `build-fresh-replacement-integrity-${viewport.label}-${mode}`);
    await assertNoRootOverflow(page, `${viewport.label}: ${mode}`);
    const signature = await readRuntimeSignature(page);
    surfaceRecords[mode] = signature;
    assert(signature.projectName === 'RB Build Fresh Replacement Target', `${viewport.label}: ${mode} must keep target identity`);
    assert(!signature.nodeIds.some((id) => source.nodeIds.includes(id)), `${viewport.label}: ${mode} leaked old node ids`);
    assert(!signature.rows.some((row) => source.rows.some((oldRow) => oldRow.id === row.id && oldRow.nodeId === row.nodeId)), `${viewport.label}: ${mode} leaked old IO rows`);
    if (mode === 'verify' || mode === 'hardware' || mode === 'export') {
      assert(signature.verifyLastRunStatus === null, `${viewport.label}: ${mode} must not keep old Verify proof`);
      assert(signature.lastExportStatus === null, `${viewport.label}: ${mode} must not keep old Export package state`);
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
  await page.goto(`${baseUrl}/?e2e=1&gate=build-fresh-replacement-integrity-${viewport.label}-storage-reset`, {
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

function assertSameProject(expected, actual, label, options = {}) {
  if (options.compareProjectId !== false) {
    assert(actual.projectId === expected.projectId, `${label}: project id changed`);
  }
  if (options.compareProjectName !== false) {
    assert(actual.projectName === expected.projectName, `${label}: project name changed`);
  }
  if (options.compareProjectKind !== false) {
    assert(actual.projectKind === expected.projectKind, `${label}: project kind changed`);
  }
  assert(actual.nodes === expected.nodes, `${label}: node count changed ${expected.nodes} -> ${actual.nodes}`);
  assert(actual.connections === expected.connections, `${label}: connection count changed`);
  assert(JSON.stringify(actual.nodeIds) === JSON.stringify(expected.nodeIds), `${label}: node ids changed`);
  assert(JSON.stringify(actual.rows) === JSON.stringify(expected.rows), `${label}: IO rows changed`);
}

function assertFreshEmptyTarget(actual, source, label) {
  assert(actual.projectName === 'RB Build Fresh Replacement Target', `${label}: target name missing, got ${actual.projectName}`);
  assert(actual.projectKind === 'blank', `${label}: target must be a blank project, got ${actual.projectKind}`);
  assert(actual.sourceExampleId === null, `${label}: source example must be cleared`);
  assert(actual.activeExampleId === null, `${label}: active example must be cleared`);
  assert(actual.nodes === 0, `${label}: target must have zero nodes, got ${actual.nodes}`);
  assert(actual.connections === 0, `${label}: target must have zero wires, got ${actual.connections}`);
  assert(actual.rows.length === 0, `${label}: target must have zero IO rows, got ${actual.rows.length}`);
  assert(actual.projectId !== source.projectId, `${label}: replacement must create a new project id`);
  assert(actual.hardwareEntries === 0, `${label}: target must clear hardwareMappingV2 entries, got ${actual.hardwareEntries}`);
  assert(actual.projectVectors === 0, `${label}: target must clear project vectors, got ${actual.projectVectors}`);
  assert(actual.customVectors === 0, `${label}: target must clear custom vectors, got ${actual.customVectors}`);
  assert(actual.verifyRunHistory === 0, `${label}: target must clear verify run history, got ${actual.verifyRunHistory}`);
  assert(actual.verifyLastRunStatus === null, `${label}: target must clear verifyLastRun`);
  assert(actual.lastVerifyStatus === null, `${label}: target must clear projectHealth lastVerify`);
  assert(actual.lastExportStatus === null, `${label}: target must clear projectHealth lastExport`);
}

async function capture(page, viewport, slug) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${safeName(viewport.label)}-${slug}.png`),
    fullPage: true,
  }).catch(() => null);
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-');
}
