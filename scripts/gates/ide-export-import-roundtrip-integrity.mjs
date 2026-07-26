#!/usr/bin/env node

import crypto from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
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
  'export-import-roundtrip-integrity',
);
const FIXTURE_DIR = path.join(ARTIFACT_ROOT, 'fixtures');
const DOWNLOAD_DIR = path.join(ARTIFACT_ROOT, 'downloads');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(FIXTURE_DIR, { recursive: true });
await mkdir(DOWNLOAD_DIR, { recursive: true });
await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE export/import roundtrip integrity satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const fixtures = await buildFixtures();
  const records = [];
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      records.push(await runViewportScenario(page, baseUrl, viewport, fixtures));
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
      await capture(page, viewport, 'failure');
    }
  }

  const summary = {
    gate: 'ide-export-import-roundtrip-integrity',
    generatedAtIso: new Date().toISOString(),
    records,
    browserProblems,
    failures,
  };
  await writeFile(
    path.join(ARTIFACT_ROOT, 'roundtrip-summary.json'),
    JSON.stringify(summary, null, 2),
  );

  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Export/import roundtrip failures:\n${failures.join('\n')}`);
});

async function runViewportScenario(page, baseUrl, viewport, fixtures) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=export-import-roundtrip-integrity-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}: startup`);
  await assertNoRootOverflow(page, `${viewport.label}: project startup`);

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  const original = await readRuntimeSignature(page);

  await openImportFromProject(page, baseUrl, viewport);
  await ensureUploadStage(page);
  await uploadZip(page, fixtures.adderZip);
  await page.locator('[data-testid="ide-import-zip-inspection"]').waitFor({ state: 'visible', timeout: 30000 });
  const authorityText = await readText(page.locator('[data-testid="ide-import-zip-authority"]').first());
  assert(
    /embedded manifest|one source of truth/i.test(authorityText),
    `${viewport.label}: manifest import must identify the embedded RedByte manifest as authoritative`,
  );

  await processImport(page);
  await page.locator('[data-testid="ide-import-commit-preview"]').waitFor({ state: 'visible', timeout: 30000 });
  assert(
    await runtimeStillMatches(page, original),
    `${viewport.label}: import review must not replace the current project before Apply`,
  );
  await capture(page, viewport, 'import-review-before-cancel');

  await page.locator('[data-testid="ide-import-apply-cancel"]').first().click();
  await page.locator('[data-testid="ide-import-commit-preview"]').first().waitFor({ state: 'hidden', timeout: 10000 });
  assert(
    await runtimeStillMatches(page, original),
    `${viewport.label}: Cancel import must preserve the active project`,
  );

  await processImport(page);
  await page.locator('[data-testid="ide-import-commit-preview"]').waitFor({ state: 'visible', timeout: 30000 });
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid="ide-import-apply-confirm"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    return state?.projectName === 'Round 5 Four Bit Adder Roundtrip';
  }, { timeout: 10000 });
  const restoredAfterApply = await readRuntimeSignature(page);
  assert(
    restoredAfterApply.verifyLastRunStatus === null && restoredAfterApply.dirtySinceVerify === true,
    `${viewport.label}: imported project must require fresh Verify proof`,
  );

  await openMode(page, baseUrl, 'export', `export-import-roundtrip-integrity-${viewport.label}-preverify-export`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const preVerifyExportText = await readText(page.locator('[data-testid="ide-mode-export"]').first());
  assert(
    /verify|run|rerun|not run|needs/i.test(preVerifyExportText),
    `${viewport.label}: Export must not treat imported Verify evidence as trusted before a fresh run`,
  );

  await runComparePass(page, baseUrl, viewport, 'fresh-import');
  await openMode(page, baseUrl, 'export', `export-import-roundtrip-integrity-${viewport.label}-baseline`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  await assertNoHardwareOverclaim(page, viewport, 'baseline export');

  const baseline = await downloadZip(page, viewport, 'baseline');
  const repeat = await downloadZip(page, viewport, 'repeat');
  assert(
    baseline.rawHash === repeat.rawHash,
    `${viewport.label}: repeated export ZIP hash drifted (${baseline.rawHash} != ${repeat.rawHash})`,
  );
  assertExportZipShape(baseline, viewport, 'baseline');

  const mappingChanged = await changeCoutMappingAndExport(page, baseUrl, viewport, baseline);
  const testbenchChanged = await flipExpectedAndExport(page, baseUrl, viewport, baseline);

  await openImportFromProject(page, baseUrl, viewport);
  await ensureUploadStage(page);
  await uploadZip(page, baseline.zipPath);
  await page.locator('[data-testid="ide-import-zip-inspection"]').waitFor({ state: 'visible', timeout: 30000 });
  await processImport(page);
  await page.locator('[data-testid="ide-import-commit-preview"]').waitFor({ state: 'visible', timeout: 30000 });
  const beforeRestoreApply = await readRuntimeSignature(page);
  assert(
    beforeRestoreApply.mappingRows.some((row) => row.label === 'Cout' && /LD5|U15/i.test(row.pin)),
    `${viewport.label}: restore review must not replace the mapping-mutated project before Apply`,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid="ide-import-apply-confirm"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 30000 });

  const restored = await readRuntimeSignature(page);
  assert(
    restored.projectName === 'Round 5 Four Bit Adder Roundtrip' &&
      restored.nodes === 18 &&
      restored.connections === 17 &&
      restored.mappingRows.some((row) => row.label === 'Cout' && /LD4|W18/i.test(row.pin)),
    `${viewport.label}: restored project must match the baseline adder mapping/circuit`,
  );
  assert(
    restored.verifyLastRunStatus === null && restored.dirtySinceVerify === true,
    `${viewport.label}: restored import must clear Verify proof again`,
  );

  await runComparePass(page, baseUrl, viewport, 'restored-import');
  await openMode(page, baseUrl, 'export', `export-import-roundtrip-integrity-${viewport.label}-restored`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const restoredExport = await downloadZip(page, viewport, 'restored');
  assertStableReexportMatches(baseline, restoredExport, viewport);

  await assertInvalidImportDoesNotReplace(page, baseUrl, viewport, fixtures.invalidText, restored);

  await capture(page, viewport, 'roundtrip-complete');
  return {
    viewport: viewport.label,
    baselineHash: baseline.rawHash,
    restoredRawHash: restoredExport.rawHash,
    baselineStableHash: baseline.stableHash,
    restoredStableHash: restoredExport.stableHash,
    mappingChangedHash: mappingChanged.rawHash,
    testbenchChangedHash: testbenchChanged.rawHash,
    restored,
  };
}

async function openImportFromProject(page, baseUrl, viewport) {
  await openMode(page, baseUrl, 'project', `export-import-roundtrip-integrity-${viewport.label}-project`);
  const importPath = page.locator('[data-testid="ide-project-path-import-recover"]').first();
  if (await visible(importPath)) {
    await importPath.click();
  } else {
    const importPrimary = page.locator('[data-testid="ide-project-import-primary"]').first();
    if (await visible(importPrimary)) {
      await importPrimary.click();
    } else {
      await openMode(page, baseUrl, 'import', `export-import-roundtrip-integrity-${viewport.label}-import`);
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

async function runComparePass(page, baseUrl, viewport, label) {
  await openMode(page, baseUrl, 'verify', `export-import-roundtrip-integrity-${viewport.label}-${label}-verify`);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: ${label} Compare mode must be selectable`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 30000 });
  const status = await readText(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyPass(status), `${viewport.label}: ${label} Compare should pass, got "${status}"`);
}

async function changeCoutMappingAndExport(page, baseUrl, viewport, baseline) {
  await openMode(page, baseUrl, 'hardware', `export-import-roundtrip-integrity-${viewport.label}-mapping`);
  await page.waitForSelector('[data-testid="ide-hardware-panel"]', { timeout: 15000 });
  const coutRow = await page.evaluate(() => {
    const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [];
    return rows.find((row) => /cout/i.test(row.label ?? '')) ?? null;
  });
  assert(coutRow?.id, `${viewport.label}: Cout mapping row must exist`);
  await mapRowToAlias(page, coutRow.id, 'LD5');
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [])
      .some((row) => /cout/i.test(row.label ?? '') && /LD5|U15/i.test(row.pin ?? '')),
    { timeout: 10000 },
  );

  await openMode(page, baseUrl, 'export', `export-import-roundtrip-integrity-${viewport.label}-mapping-export`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const changed = await downloadZip(page, viewport, 'mapping-changed');
  assert(
    changed.rawHash !== baseline.rawHash,
    `${viewport.label}: mapping change must alter the exported ZIP hash`,
  );
  assert(
    readZipText(changed, /top\.xdc$/i).includes('U15') &&
      !sameText(readZipText(changed, /top\.xdc$/i), readZipText(baseline, /top\.xdc$/i)),
    `${viewport.label}: mapping change must alter top.xdc`,
  );
  return changed;
}

async function flipExpectedAndExport(page, baseUrl, viewport, baseline) {
  await openMode(page, baseUrl, 'verify', `export-import-roundtrip-integrity-${viewport.label}-expected-edit`);
  const s0FieldId = await resolveExpectedFieldId(page, 'S0', 1);
  await flipExpectedCell(page, s0FieldId, 1);
  await openMode(page, baseUrl, 'export', `export-import-roundtrip-integrity-${viewport.label}-testbench-export`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const changed = await downloadZip(page, viewport, 'testbench-changed');
  assert(
    changed.rawHash !== baseline.rawHash,
    `${viewport.label}: expected-vector edit must alter the exported ZIP hash`,
  );
  assert(
    !sameText(readZipText(changed, /testbench\.vhd$/i), readZipText(baseline, /testbench\.vhd$/i)),
    `${viewport.label}: expected-vector edit must alter testbench.vhd`,
  );
  return changed;
}

async function resolveExpectedFieldId(page, preferredLabel, tick) {
  await page.waitForSelector(`[data-testid^="ide-stimulus-expected-"][data-testid$="-t${tick}"]`, {
    timeout: 15000,
  });
  const candidateIds = await page
    .locator(`[data-testid^="ide-stimulus-expected-"][data-testid$="-t${tick}"]`)
    .evaluateAll((elements, tickValue) =>
      elements
        .map((element) => element.getAttribute('data-testid') ?? '')
        .map((testId) => new RegExp(`^ide-stimulus-expected-(.+)-t${tickValue}$`).exec(testId)?.[1] ?? '')
        .filter(Boolean),
      tick,
    );
  const preferredKeys = await page.evaluate((label) => {
    const normalizedLabel = String(label ?? '').trim().toLowerCase();
    const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [];
    return rows
      .filter((row) => row.direction === 'out' && String(row.label ?? '').trim().toLowerCase() === normalizedLabel)
      .flatMap((row) => [row.id, row.nodeId, row.label])
      .filter(Boolean)
      .map((value) => String(value));
  }, preferredLabel);
  for (const key of preferredKeys) {
    const exact = candidateIds.find((candidate) => candidate === key);
    if (exact) return exact;
  }
  for (const key of preferredKeys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const partial = candidateIds.find(
      (candidate) => candidate.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalizedKey,
    );
    if (partial) return partial;
  }
  const first = candidateIds[0];
  assert(first, `No Verify expected-output cell was rendered for tick ${tick}`);
  return first;
}

async function assertInvalidImportDoesNotReplace(page, baseUrl, viewport, invalidTextPath, expectedRuntime) {
  await openImportFromProject(page, baseUrl, viewport);
  await ensureUploadStage(page);
  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles(invalidTextPath);
  const zipError = page.locator('[data-testid="ide-import-zip-error"]').first();
  await zipError.waitFor({ state: 'visible', timeout: 10000 });
  const errorText = await readText(zipError);
  assert(
    /\.zip archive|zip import|could not open zip|requires a \.zip/i.test(errorText),
    `${viewport.label}: invalid non-ZIP import needs a visible ZIP error; got "${errorText}"`,
  );
  assert(
    await runtimeStillMatches(page, expectedRuntime),
    `${viewport.label}: invalid import must not replace the restored project`,
  );
}

async function downloadZip(page, viewport, label) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    clickFirstVisible(page, [
      '[data-testid="ide-export-package-download-v1"]',
      '[data-testid="ide-export-rebuild-btn"]',
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
  const stableTexts = {};
  for (const [entry, value] of Object.entries(texts)) {
    stableTexts[entry] = normalizeStableExportText(entry, value);
  }
  const stableHash = sha256(JSON.stringify({
    entries,
    texts: Object.fromEntries(
      entries.map((entry) => [entry, sha256(stableTexts[entry])]),
    ),
  }));
  return {
    zipPath,
    rawHash: sha256(bytes),
    stableHash,
    entries,
    texts,
    stableTexts,
  };
}

function assertExportZipShape(zipRecord, viewport, label) {
  const required = [
    /\/project\.rbproj\.json$/i,
    /\/README\.txt$/i,
    /\/EXPECTED_IO\.json$/i,
    /\/.*\.xpr$/i,
    /\/top\.vhd$/i,
    /\/top\.xdc$/i,
    /\/testbench\.vhd$/i,
  ];
  for (const pattern of required) {
    assert(
      zipRecord.entries.some((entry) => pattern.test(entry)),
      `${viewport.label}: ${label} ZIP missing ${pattern}`,
    );
  }
  const project = JSON.parse(readZipText(zipRecord, /project\.rbproj\.json$/i));
  assert(project.name === 'Round 5 Four Bit Adder Roundtrip', `${viewport.label}: ${label} manifest project name drifted`);
  assert((project.circuit?.nodes?.length ?? 0) === 18, `${viewport.label}: ${label} manifest must preserve 18 adder nodes`);
  assert((project.circuit?.connections?.length ?? 0) === 17, `${viewport.label}: ${label} manifest must preserve 17 adder wires`);
  assert(/SW8|V2/i.test(readZipText(zipRecord, /top\.xdc$/i)), `${viewport.label}: ${label} top.xdc must include carry-in mapping`);
  assert(/LD4|W18|Cout/i.test(readZipText(zipRecord, /EXPECTED_IO\.json$/i)), `${viewport.label}: ${label} EXPECTED_IO must include carry-out evidence`);
  assertNoHardwareOverclaimText(readZipText(zipRecord, /README\.txt$/i), `${viewport.label}: ${label} README`);
}

function assertStableReexportMatches(baseline, restored, viewport) {
  assert(
    restored.stableHash === baseline.stableHash,
    `${viewport.label}: restored re-export stable content drifted (${restored.stableHash} != ${baseline.stableHash})`,
  );
  for (const pattern of [/project\.rbproj\.json$/i, /top\.vhd$/i, /top\.xdc$/i, /testbench\.vhd$/i]) {
    assert(
      sameText(readZipText(restored, pattern), readZipText(baseline, pattern)),
      `${viewport.label}: restored re-export changed ${pattern}`,
    );
  }
}

async function assertNoHardwareOverclaim(page, viewport, label) {
  const surfaceText = await readText(page.locator('[data-testid="ide-mode-export"]').first());
  assertNoHardwareOverclaimText(surfaceText, `${viewport.label}: ${label}`);
}

function assertNoHardwareOverclaimText(value, label) {
  const forbidden = [
    /observed physical board/i,
    /programmed (the )?board/i,
    /vivado build passed/i,
    /bitstream verified/i,
    /hardware proof/i,
  ];
  const hit = forbidden.find((pattern) => pattern.test(value));
  assert(!hit, `${label} must not overclaim Vivado or board proof: ${hit}`);
}

function readZipText(zipRecord, pattern) {
  const entry = zipRecord.entries.find((candidate) => pattern.test(candidate));
  assert(entry, `ZIP entry matching ${pattern} must exist`);
  return zipRecord.texts[entry];
}

function normalizeStableExportText(entry, value) {
  let text = String(value ?? '').replace(/\r\n/g, '\n');
  if (/EXPECTED_IO\.json$/i.test(entry)) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        parsed.generatedAtIso = '<verify-generated-at>';
      }
      text = JSON.stringify(parsed);
    } catch {
      // Keep raw text if the file is unexpectedly not JSON; shape assertions fail elsewhere.
    }
  }
  return text;
}

async function readRuntimeSignature(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const rows = state?.projectIoRows ?? [];
    return {
      projectName: state?.projectName ?? null,
      nodes: state?.circuit?.nodes?.length ?? 0,
      connections: state?.circuit?.connections?.length ?? 0,
      mappingRows: rows.map((row) => ({
        id: row.id ?? '',
        label: row.label ?? '',
        nodeId: row.nodeId ?? '',
        pin: row.pin ?? '',
        direction: row.direction ?? '',
      })).sort((left, right) => `${left.label}:${left.id}`.localeCompare(`${right.label}:${right.id}`)),
      verifyLastRunStatus: state?.verifyLastRun?.status ?? null,
      dirtySinceVerify: state?.projectHealthCore?.dirtySinceVerify ?? null,
      dirtySinceExport: state?.projectHealthCore?.dirtySinceExport ?? null,
    };
  });
}

async function runtimeStillMatches(page, expected) {
  const current = await readRuntimeSignature(page);
  return (
    current.projectName === expected.projectName &&
    current.nodes === expected.nodes &&
    current.connections === expected.connections &&
    JSON.stringify(current.mappingRows) === JSON.stringify(expected.mappingRows)
  );
}

async function mapRowToAlias(page, rowId, alias) {
  await clickFirstVisible(page, [`[data-testid="ide-hw-map-row-${rowId}"]`], `mapping row ${rowId}`);
  const select = page.locator('[data-testid="ide-hw-direct-resource-select"]').first();
  await select.waitFor({ state: 'visible', timeout: 10000 });
  await select.selectOption(alias);
  await page.locator('[data-testid="ide-hw-assign-selected-resource"]').first().click();
}

async function flipExpectedCell(page, fieldId, tick) {
  const testId = `ide-stimulus-expected-${fieldId}-t${tick}`;
  const current = await readCellValue(page, testId);
  assert(current === 0 || current === 1, `Expected ${testId} to have a saved value before flip`);
  await setExpectedCell(page, fieldId, tick, current === 0 ? 1 : 0);
}

async function setExpectedCell(page, fieldId, tick, value) {
  const testId = `ide-stimulus-expected-${fieldId}-t${tick}`;
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const current = await readCellValue(page, testId);
  assert(current === value, `Expected ${testId} to become ${value}, got ${current}`);
}

async function readCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
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
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${safeName(viewport.label)}-${slug}.png`),
    fullPage: true,
  }).catch(() => null);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sameText(left, right) {
  return String(left ?? '').replace(/\r\n/g, '\n') === String(right ?? '').replace(/\r\n/g, '\n');
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-');
}

async function buildFixtures() {
  const project = buildAdderProject();
  const adderZip = path.join(FIXTURE_DIR, 'round5-four-bit-adder-redbyte.zip');
  const invalidText = path.join(FIXTURE_DIR, 'not-a-redbyte-zip.txt');
  const emptyZip = path.join(FIXTURE_DIR, 'empty-redbyte.zip');

  const zip = new JSZip();
  const fixedDate = new Date('2026-01-01T00:00:00.000Z');
  zip.file('round5/project.rbproj.json', JSON.stringify(project, null, 2), { date: fixedDate });
  zip.file('round5/top.vhd', buildAdderVhdl(), { date: fixedDate });
  zip.file('round5/top.xdc', buildAdderXdc(), { date: fixedDate });
  zip.file('round5/README.txt', 'RedByte Round 5 import/export integrity fixture. E0 package only.', { date: fixedDate });
  await writeFile(adderZip, await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
    platform: 'DOS',
  }));

  await writeFile(invalidText, 'This is not a ZIP file.');
  const missing = new JSZip();
  missing.file('README.txt', 'No RedByte project manifest here.', { date: fixedDate });
  await writeFile(emptyZip, await missing.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
    platform: 'DOS',
  }));

  return { adderZip, invalidText, emptyZip };
}

function buildAdderProject() {
  const nodes = [
    node('a0_node', 'INPUT', 80, 90, 'A0'),
    node('a1_node', 'INPUT', 80, 170, 'A1'),
    node('a2_node', 'INPUT', 80, 250, 'A2'),
    node('a3_node', 'INPUT', 80, 330, 'A3'),
    node('b0_node', 'INPUT', 200, 90, 'B0'),
    node('b1_node', 'INPUT', 200, 170, 'B1'),
    node('b2_node', 'INPUT', 200, 250, 'B2'),
    node('b3_node', 'INPUT', 200, 330, 'B3'),
    node('cin_node', 'INPUT', 80, 430, 'Cin'),
    node('fa0', 'FullAdder', 380, 110, 'FA0'),
    node('fa1', 'FullAdder', 520, 190, 'FA1'),
    node('fa2', 'FullAdder', 660, 270, 'FA2'),
    node('fa3', 'FullAdder', 800, 350, 'FA3'),
    node('s0_out', 'OUTPUT', 1020, 110, 'S0'),
    node('s1_out', 'OUTPUT', 1020, 190, 'S1'),
    node('s2_out', 'OUTPUT', 1020, 270, 'S2'),
    node('s3_out', 'OUTPUT', 1020, 350, 'S3'),
    node('cout_out', 'OUTPUT', 1020, 440, 'Cout'),
  ];
  const connections = [
    wire('a0_node', 'out', 'fa0', 'A'),
    wire('b0_node', 'out', 'fa0', 'B'),
    wire('cin_node', 'out', 'fa0', 'Cin'),
    wire('fa0', 'Sum', 's0_out', 'in'),
    wire('fa0', 'Cout', 'fa1', 'Cin'),
    wire('a1_node', 'out', 'fa1', 'A'),
    wire('b1_node', 'out', 'fa1', 'B'),
    wire('fa1', 'Sum', 's1_out', 'in'),
    wire('fa1', 'Cout', 'fa2', 'Cin'),
    wire('a2_node', 'out', 'fa2', 'A'),
    wire('b2_node', 'out', 'fa2', 'B'),
    wire('fa2', 'Sum', 's2_out', 'in'),
    wire('fa2', 'Cout', 'fa3', 'Cin'),
    wire('a3_node', 'out', 'fa3', 'A'),
    wire('b3_node', 'out', 'fa3', 'B'),
    wire('fa3', 'Sum', 's3_out', 'in'),
    wire('fa3', 'Cout', 'cout_out', 'in'),
  ];
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-06-28T12:00:00.000Z',
    updatedAt: '2026-06-28T12:00:00.000Z',
    name: 'Round 5 Four Bit Adder Roundtrip',
    description: 'Round 5 fixture: imported RedByte manifest for export/import integrity proof.',
    circuit: { nodes, connections },
    ioMapping: {
      inputs: [
        input('a0', 'a0_node', 'A0', 'SW0'),
        input('a1', 'a1_node', 'A1', 'SW1'),
        input('a2', 'a2_node', 'A2', 'SW2'),
        input('a3', 'a3_node', 'A3', 'SW3'),
        input('b0', 'b0_node', 'B0', 'SW4'),
        input('b1', 'b1_node', 'B1', 'SW5'),
        input('b2', 'b2_node', 'B2', 'SW6'),
        input('b3', 'b3_node', 'B3', 'SW7'),
        input('cin', 'cin_node', 'Cin', 'SW8'),
      ],
      outputs: [
        output('s0', 's0_out', 'S0', 'LD0'),
        output('s1', 's1_out', 'S1', 'LD1'),
        output('s2', 's2_out', 'S2', 'LD2'),
        output('s3', 's3_out', 'S3', 'LD3'),
        output('cout', 'cout_out', 'Cout', 'LD4'),
      ],
    },
    vectors: buildAdderVectors(),
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
      constraints: {
        type: 'xdc',
        text: buildAdderXdc(),
      },
    },
    meta: {
      projectId: 'round5-four-bit-adder-roundtrip',
      projectKind: 'import',
      sourceExampleId: null,
      scenarioAuthority: 'authored',
      tags: ['round5', 'export-import-roundtrip', 'four-bit-adder'],
    },
  };
}

function node(id, type, x, y, label) {
  return { id, type, x, y, position: { x, y }, label, config: {}, state: {} };
}

function wire(fromNode, fromPort, toNode, toPort) {
  return {
    from: { nodeId: fromNode, portName: fromPort },
    to: { nodeId: toNode, portName: toPort },
  };
}

function input(id, nodeId, label, pin) {
  return { id, nodeId, port: 'out', label, pin, required: true };
}

function output(id, nodeId, label, pin) {
  return { id, nodeId, port: 'in', label, pin, required: true };
}

function buildAdderVectors() {
  return [
    vector(0, { a: 0, b: 0, cin: 0 }),
    vector(1, { a: 1, b: 1, cin: 0 }),
    vector(2, { a: 15, b: 1, cin: 0 }),
    vector(3, { a: 15, b: 0, cin: 0 }),
    vector(4, { a: 8, b: 8, cin: 0 }),
  ];
}

function vector(tick, { a, b, cin }) {
  const total = a + b + cin;
  return {
    tick,
    inputs: {
      a0_node: bit(a, 0),
      a1_node: bit(a, 1),
      a2_node: bit(a, 2),
      a3_node: bit(a, 3),
      b0_node: bit(b, 0),
      b1_node: bit(b, 1),
      b2_node: bit(b, 2),
      b3_node: bit(b, 3),
      cin_node: cin,
    },
    expected: {
      s0_out: bit(total, 0),
      s1_out: bit(total, 1),
      s2_out: bit(total, 2),
      s3_out: bit(total, 3),
      cout_out: bit(total, 4),
    },
  };
}

function bit(value, index) {
  return (value >> index) & 1;
}

function buildAdderXdc() {
  return [
    'set_property PACKAGE_PIN V17 [get_ports {A0}]',
    'set_property PACKAGE_PIN V16 [get_ports {A1}]',
    'set_property PACKAGE_PIN W16 [get_ports {A2}]',
    'set_property PACKAGE_PIN W17 [get_ports {A3}]',
    'set_property PACKAGE_PIN W15 [get_ports {B0}]',
    'set_property PACKAGE_PIN V15 [get_ports {B1}]',
    'set_property PACKAGE_PIN W14 [get_ports {B2}]',
    'set_property PACKAGE_PIN W13 [get_ports {B3}]',
    'set_property PACKAGE_PIN V2 [get_ports {Cin}]',
    'set_property PACKAGE_PIN U16 [get_ports {S0}]',
    'set_property PACKAGE_PIN E19 [get_ports {S1}]',
    'set_property PACKAGE_PIN U19 [get_ports {S2}]',
    'set_property PACKAGE_PIN V19 [get_ports {S3}]',
    'set_property PACKAGE_PIN W18 [get_ports {Cout}]',
  ].join('\n');
}

function buildAdderVhdl() {
  return [
    'library IEEE;',
    'use IEEE.STD_LOGIC_1164.ALL;',
    'use IEEE.NUMERIC_STD.ALL;',
    'entity top is',
    '  port (',
    '    A0 : in STD_LOGIC; A1 : in STD_LOGIC; A2 : in STD_LOGIC; A3 : in STD_LOGIC;',
    '    B0 : in STD_LOGIC; B1 : in STD_LOGIC; B2 : in STD_LOGIC; B3 : in STD_LOGIC;',
    '    Cin : in STD_LOGIC;',
    '    S0 : out STD_LOGIC; S1 : out STD_LOGIC; S2 : out STD_LOGIC; S3 : out STD_LOGIC;',
    '    Cout : out STD_LOGIC',
    '  );',
    'end top;',
    'architecture rtl of top is',
    '  signal a_bus : unsigned(3 downto 0);',
    '  signal b_bus : unsigned(3 downto 0);',
    '  signal sum_bus : unsigned(4 downto 0);',
    'begin',
    '  a_bus <= A3 & A2 & A1 & A0;',
    '  b_bus <= B3 & B2 & B1 & B0;',
    "  sum_bus <= ('0' & a_bus) + ('0' & b_bus) + (0 => Cin, others => '0');",
    '  S0 <= sum_bus(0);',
    '  S1 <= sum_bus(1);',
    '  S2 <= sum_bus(2);',
    '  S3 <= sum_bus(3);',
    '  Cout <= sum_bus(4);',
    'end rtl;',
  ].join('\n');
}
