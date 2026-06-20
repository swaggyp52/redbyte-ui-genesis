#!/usr/bin/env node

/**
 * Export trust-integrity gate.
 *
 * Contract:
 * 1) Export trust labels distinguish buildable/draft from current trusted handoff.
 * 2) The selected generated preview is visible in the normal Export workspace.
 * 3) Previewed artifact bodies agree with the downloaded Vivado Project ZIP bytes.
 * 4) README/provenance wording and mapping counts agree across UI and ZIP.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(path.resolve(__dirname, '../../packages/rb-apps/package.json'));
const JSZip = require('jszip');

const HDL_PATH_PATTERN = /(^|\/)top\.vhd$/i;
const XDC_PATH_PATTERN = /(^|\/)top\.xdc$/i;
const TESTBENCH_PATH_PATTERN = /(^|\/)testbench\.vhd$/i;
const README_PATH_PATTERN = /(^|\/)README\.txt$/i;
const BRINGUP_PATH_PATTERN = /(^|\/)BRINGUP\.md$/i;
const EXPECTED_IO_PATH_PATTERN = /(^|\/)EXPECTED_IO\.json$/i;
const PROGRAM_AND_TEST_PATH_PATTERN = /(^|\/)program_and_test\.tcl$/i;
const RBPROJ_PATH_PATTERN = /(^|\/)project\.rbproj\.json$/i;

await runIdeGate('IDE export trust integrity satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-signal-tour' });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  assert(
    await setVerifyRunMode(page, 'compare'),
    'trusted export proof requires Compare checks in Verify'
  );
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const verifyStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(verifyStatus), `trusted export requires current Compare PASS, got "${verifyStatus}"`);

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-readiness-hero"]', { timeout: 10000 });

  await openDetailsContaining(page, 'ide-export-package-handoff');

  const preBuildStatus = await text(page.locator('[data-testid="ide-export-package-handoff-status"]'));
  assert(
    /READY TO BUILD/i.test(preBuildStatus),
    `fresh verified export should begin as READY TO BUILD before package download, got "${preBuildStatus}"`
  );
  assert(
    /Build Current Bundle/i.test(await text(page.locator('[data-testid="ide-export-rebuild-btn"]'))),
    'fresh verified export should expose Build Current Bundle before a successful package record exists'
  );

  const summaryMapping = await text(
    page.locator('[data-testid="ide-export-handoff-summary-mapping"] .ide-export-handoff-summary-value')
  );
  const factMapping = await text(page.locator('[data-testid="ide-export-handoff-mapping"]'));
  assert(summaryMapping.length > 0, 'handoff summary must include mapping completeness');
  assert(
    summaryMapping === factMapping,
    `mapping summary and handoff facts must agree, got "${summaryMapping}" vs "${factMapping}"`
  );

  const evidenceRows = await text(page.locator('[data-testid="ide-export-vivado-evidence-rows"]'));
  for (const label of ['Package', 'Build', 'Program', 'Observe']) {
    assert(evidenceRows.includes(label), `Vivado evidence rows must include ${label}`);
  }
  assert(!/\bE0\b|\bE1\b|\bE2\b|\bE3\b/.test(evidenceRows), 'Vivado evidence rows must not expose E-tier labels');
  assert(/Run Vivado synthesis|Record outside RedByte/i.test(evidenceRows), 'Vivado build row must require an outside record');
  assert(/Program success proves delivery to the board only/i.test(evidenceRows), 'board programming row must not imply behavior proof');
  assert(/Manual record required|record physical/i.test(evidenceRows), 'board observation row must require a manual record');
  assert(!/Vivado build\s+(ready|passed|complete)/i.test(evidenceRows), 'browser Export must not claim Vivado build success');
  assert(!/board programming\s+(ready|passed|complete)/i.test(evidenceRows), 'browser Export must not claim board programming success');
  assert(!/observed board behavior\s+(ready|passed|complete)/i.test(evidenceRows), 'browser Export must not claim observed-board success');

  await page.waitForSelector('[data-testid="ide-export-artifact-tabs"]', { timeout: 10000 });
  const topPreview = await readVisiblePreviewByPath(page, 'top.vhd');
  assert(topPreview.length > 0, 'top.vhd preview must be visible and non-empty');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('[data-testid="ide-export-rebuild-btn"]').click(),
  ]);
  const downloadFailure = await download.failure();
  assert(!downloadFailure, `download failed: ${downloadFailure}`);

  const outDir = path.join(process.cwd(), 'out', 'gates');
  await fs.mkdir(outDir, { recursive: true });
  const zipPath = path.join(outDir, 'ide-export-trust-integrity.zip');
  await download.saveAs(zipPath);

  await page.waitForSelector('[data-testid="ide-export-download-success"]', { timeout: 10000 });
  await openDetailsContaining(page, 'ide-export-package-handoff');
  await page.waitForFunction(
    () => /READY/i.test(document.querySelector('[data-testid="ide-export-package-handoff-status"]')?.textContent ?? ''),
    { timeout: 10000 }
  );
  const trustedStatus = await text(page.locator('[data-testid="ide-export-package-handoff-status"]'));
  assert(/READY/i.test(trustedStatus), `downloaded current package must move Export to READY, got "${trustedStatus}"`);
  const trustBanner = await text(page.locator('[data-testid="ide-export-trust-banner"]'));
  assert(/READY/i.test(trustBanner), 'trusted handoff banner must show READY after current package download');
  assert(/Verify and export are current/i.test(trustBanner), 'trusted banner must tie READY to current Verify plus current export');

  const zipBytes = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBytes);
  const zipPaths = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
  assert(zipPaths.length > 0, 'downloaded Vivado Project ZIP must contain files');

  const topZipPath = requireZipPath(zipPaths, HDL_PATH_PATTERN, 'top.vhd');
  const xdcZipPath = requireZipPath(zipPaths, XDC_PATH_PATTERN, 'top.xdc');
  const testbenchZipPath = requireZipPath(zipPaths, TESTBENCH_PATH_PATTERN, 'testbench.vhd');
  const readmeZipPath = requireZipPath(zipPaths, README_PATH_PATTERN, 'README.txt');
  const bringupZipPath = requireZipPath(zipPaths, BRINGUP_PATH_PATTERN, 'BRINGUP.md');
  const expectedIoZipPath = requireZipPath(zipPaths, EXPECTED_IO_PATH_PATTERN, 'EXPECTED_IO.json');
  const programZipPath = requireZipPath(zipPaths, PROGRAM_AND_TEST_PATH_PATTERN, 'program_and_test.tcl');
  const rbprojZipPath = requireZipPath(zipPaths, RBPROJ_PATH_PATTERN, 'project.rbproj.json');

  const topZipText = normalizeArtifactText(await readZipText(zip, topZipPath));
  const xdcZipText = normalizeArtifactText(await readZipText(zip, xdcZipPath));
  const testbenchZipText = normalizeArtifactText(await readZipText(zip, testbenchZipPath));
  const bringupZipText = normalizeArtifactText(await readZipText(zip, bringupZipPath));
  const expectedIoZipText = normalizeArtifactText(await readZipText(zip, expectedIoZipPath));
  const programZipText = normalizeArtifactText(await readZipText(zip, programZipPath));
  const rbprojZipText = normalizeArtifactText(await readZipText(zip, rbprojZipPath));

  assert(stripProvenanceHeader(topZipText).startsWith(topPreview), 'top.vhd visible preview must match downloaded ZIP body');
  assert(
    stripProvenanceHeader(xdcZipText).startsWith(await readVisiblePreviewByPath(page, 'top.xdc')),
    'top.xdc visible preview must match downloaded ZIP body'
  );
  assert(
    stripProvenanceHeader(testbenchZipText).startsWith(await readVisiblePreviewByPath(page, 'testbench.vhd')),
    'testbench.vhd visible preview must match downloaded ZIP body'
  );
  assert(
    bringupZipText.startsWith(await readVisiblePreviewByPath(page, 'BRINGUP.md')),
    'BRINGUP.md visible preview must match downloaded ZIP body'
  );
  assert(
    expectedIoZipText.startsWith(await readVisiblePreviewByPath(page, 'EXPECTED_IO.json')),
    'EXPECTED_IO.json visible preview must match downloaded ZIP body'
  );
  assert(
    programZipText.startsWith(await readVisiblePreviewByPath(page, 'program_and_test.tcl')),
    'program_and_test.tcl visible preview must match downloaded ZIP body'
  );
  assert(
    rbprojZipText.startsWith(await readVisiblePreviewByPath(page, 'project.rbproj.json')),
    'project.rbproj.json visible preview must match downloaded ZIP body'
  );

  for (const [artifactPath, artifactText] of [
    [topZipPath, topZipText],
    [xdcZipPath, xdcZipText],
    [testbenchZipPath, testbenchZipText],
  ]) {
    assert(/RedByte IDE Export/i.test(artifactText), `${artifactPath} must include RedByte provenance header`);
    assert(/Board:\s*Basys3/i.test(artifactText), `${artifactPath} provenance must name Basys3`);
    assert(/Export hash:/i.test(artifactText), `${artifactPath} provenance must include export hash`);
    assert(/Generated automatically/i.test(artifactText), `${artifactPath} provenance must warn against hand edits`);
  }

  const readmePreview = await readVisiblePreviewByPath(page, 'README.txt');
  const readmeZipText = normalizeArtifactText(await readZipText(zip, readmeZipPath));
  assert(/E0 package evidence only|Evidence level:\s*E0 export package only/i.test(readmePreview), 'README preview must state E0 boundary');
  assert(/E0 package evidence only|Evidence level:\s*E0 export package only/i.test(readmeZipText), 'downloaded README must state E0 boundary');
  assert(/E1\/E2\/E3 evidence separately/i.test(readmePreview), 'README preview must keep E1/E2/E3 external');
  assert(/E1\/E2\/E3 evidence separately/i.test(readmeZipText), 'downloaded README must keep E1/E2/E3 external');
  assert(/does not prove Vivado build\/bitstream success|does not prove Vivado build/i.test(readmeZipText), 'downloaded README must not overclaim Vivado build proof');
  assert(/Pin map/i.test(readmePreview), 'README preview must expose the mapping summary for the flat handoff kit');

  const mappedPins = extractMappedCount(summaryMapping);
  const xdcAssignments = parseXdcPackagePinRows(xdcZipText);
  assert(xdcAssignments.length === mappedPins, `XDC mapped row count ${xdcAssignments.length} must match UI mapping count ${mappedPins}`);

  const expectedIo = JSON.parse(expectedIoZipText);
  const expectedIoRows = extractExpectedIoRows(expectedIo);
  const rbproj = JSON.parse(rbprojZipText);
  const mappedOutputs = countMappedOutputs(rbproj);
  assert(
    expectedIoRows.length === mappedOutputs,
    `EXPECTED_IO.json must cover mapped outputs, got ${expectedIoRows.length} expected rows for ${mappedOutputs} mapped outputs`
  );
});

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function openDetailsContaining(page, testId) {
  const details = page.locator(`details:has([data-testid="${testId}"])`).first();
  assert((await details.count().catch(() => 0)) > 0, `details containing ${testId} must exist`);
  const isOpen = await details.evaluate((element) => element instanceof HTMLDetailsElement && element.open);
  if (!isOpen) {
    await details.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const summary = details.locator('summary').first();
    if (await summary.isVisible().catch(() => false)) {
      await summary.click();
    } else {
      await details.evaluate((element) => {
        if (element instanceof HTMLDetailsElement) {
          element.open = true;
        }
      });
    }
  }
  await page.locator(`[data-testid="${testId}"]`).first().waitFor({ state: 'attached', timeout: 5000 });
}

async function readVisiblePreviewByPath(page, artifactPath) {
  const tab = page
    .locator('[data-testid^="ide-export-artifact-tab-"]')
    .filter({ hasText: artifactPath })
    .first();
  assert(await tab.isVisible().catch(() => false), `artifact tab for "${artifactPath}" must be visible`);
  await tab.click();
  await page.waitForFunction(
    (expected) => {
      const marker = document.querySelector('[data-testid="ide-export-preview-path"]');
      return (marker?.textContent ?? '').trim() === expected;
    },
    artifactPath,
    { timeout: 10000 }
  );
  const preview = page.locator('[data-testid="ide-export-preview-code"]').first();
  assert(
    await preview.isVisible().catch(() => false),
    `${artifactPath} selected generated preview must be visible in the Export workspace`
  );
  return normalizeArtifactText(await preview.textContent().catch(() => ''));
}

async function readZipText(zip, zipPath) {
  const file = zip.file(zipPath);
  assert(Boolean(file), `ZIP file ${zipPath} must be readable`);
  return file.async('string');
}

function requireZipPath(paths, pattern, label) {
  const exact = paths.find((entry) => pattern.test(entry));
  if (exact) return exact;
  const fallback = paths.find((entry) => pattern.test(path.posix.basename(entry)));
  assert(Boolean(fallback), `missing required ZIP artifact: ${label}`);
  return fallback;
}

function normalizeArtifactText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function stripProvenanceHeader(value) {
  const lines = normalizeArtifactText(value).split('\n');
  if (
    lines.length >= 6 &&
    /^(--|#)\s*=+/.test(lines[0] ?? '') &&
    /RedByte IDE Export/i.test(lines[1] ?? '') &&
    /Generated automatically/i.test(lines[4] ?? '') &&
    /^(--|#)\s*=+/.test(lines[5] ?? '')
  ) {
    return normalizeArtifactText(lines.slice(6).join('\n'));
  }
  return normalizeArtifactText(value);
}

function extractMappedCount(summary) {
  const text = String(summary);
  const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) return Number(fractionMatch[1]);
  const requiredMatch = text.match(/(\d+)\s+of\s+\d+\s+required/i);
  if (requiredMatch) return Number(requiredMatch[1]);
  const mappedRowsMatch = text.match(/(\d+)\s+mapped\s+board\s+I\/O\s+rows?/i);
  if (mappedRowsMatch) return Number(mappedRowsMatch[1]);
  assert(false, `mapping summary must include a mapped count, got "${summary}"`);
  return 0;
}

function parseXdcPackagePinRows(xdcText) {
  const rows = [];
  const dictRegex =
    /set_property\s+-dict\s+\{\s*PACKAGE_PIN\s+([A-Za-z0-9]+)\s+IOSTANDARD\s+[A-Za-z0-9_]+\s*\}\s+\[get_ports\s+\{([^}]+)\}\]/gi;
  const simpleRegex =
    /set_property\s+PACKAGE_PIN\s+([A-Za-z0-9]+)\s+\[get_ports\s+\{([^}]+)\}\]/gi;

  let match;
  while ((match = dictRegex.exec(xdcText)) !== null) {
    rows.push({ packagePin: String(match[1] ?? '').trim(), portName: String(match[2] ?? '').trim() });
  }
  while ((match = simpleRegex.exec(xdcText)) !== null) {
    rows.push({ packagePin: String(match[1] ?? '').trim(), portName: String(match[2] ?? '').trim() });
  }
  return rows.filter((row) => row.packagePin.length > 0 && row.portName.length > 0);
}

function extractExpectedIoRows(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.signals)) {
    return value.signals.filter((entry) => entry && typeof entry === 'object');
  }
  const rows = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const values = Object.values(node);
    if (
      values.some((entry) => typeof entry === 'string' && /^(SW|LD|BTN|CLK|JA|JB|JC|JXADC)/i.test(entry)) ||
      values.some((entry) => typeof entry === 'string' && /^[A-Z]\d{1,2}$/i.test(entry))
    ) {
      rows.push(node);
    }
    for (const item of values) walk(item);
  };
  walk(value);
  return rows;
}

function countMappedOutputs(project) {
  const outputs = Array.isArray(project?.ioMapping?.outputs) ? project.ioMapping.outputs : [];
  return outputs.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return typeof entry.pin === 'string' && entry.pin.trim().length > 0;
  }).length;
}
