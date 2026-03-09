#!/usr/bin/env node

/**
 * IDE export end-to-end contract gate.
 *
 * Contract:
 * 1) Generated HDL preview content must match downloaded Vivado Kit ZIP bytes.
 * 2) ZIP must contain Vivado-ready artifacts.
 * 3) XDC PACKAGE_PIN lines must cover mapped ports from project state.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assert, runIdeGate } from './_gateHarness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(
  path.resolve(__dirname, '../../packages/rb-apps/package.json')
);
const JSZip = require('jszip');

const HDL_PATH_PATTERN = /(^|\/)(top\.vhd|top\.v|top\.sv)$/i;
const XDC_PATH_PATTERN = /(^|\/)(top\.xdc|constraints\.xdc)$/i;
const TESTBENCH_PATH_PATTERN = /(^|\/)(testbench\.vhd)$/i;
const README_PATH_PATTERN = /(^|\/)readme\.txt$/i;
const VIVADO_IMPORT_TCL_PATTERN = /(^|\/)vivado_import\.tcl$/i;
const PROJECT_RBPROJ_PATTERN = /(^|\/)project\.rbproj\.json$/i;

await runIdeGate('IDE export e2e contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-project-load-start-logic-gates"]').click();
  const replaceModalVisible = await page
    .locator('[data-testid="ide-example-confirm-modal"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (replaceModalVisible) {
    await page.locator('[data-testid="ide-example-confirm"]').click();
  }

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  await clickVerifyRun(page);
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(status && /(PASS|TRACE|FAIL)/i.test(status.textContent || ''));
    },
    { timeout: 10000 }
  );

  let verifyStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  if (!/PASS/i.test(verifyStatus)) {
    const setOracle = page.locator('[data-testid="ide-verify-set-oracle"]').first();
    const oracleVisible = await setOracle.isVisible().catch(() => false);
    if (oracleVisible) {
      await setOracle.click();
      await clickVerifyRun(page);
      await page.waitForFunction(
        () => {
          const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
          return Boolean(status && /PASS/i.test(status.textContent || ''));
        },
        { timeout: 10000 }
      );
    }
  }

  verifyStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(/PASS/i.test(verifyStatus), `verify must be PASS before export download, got "${verifyStatus}"`);

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-artifact-preview"]', { timeout: 10000 });

  const artifactPaths = (await page
    .locator('[data-testid^="ide-export-artifact-tab-"]')
    .allTextContents())
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  assert(artifactPaths.length > 0, 'export artifact tabs must be present');

  const previewTopPath = requireArtifactPath(artifactPaths, HDL_PATH_PATTERN, 'top HDL preview');
  const previewXdcPath = requireArtifactPath(artifactPaths, XDC_PATH_PATTERN, 'constraints preview');
  const previewTestbenchPath = requireArtifactPath(
    artifactPaths,
    TESTBENCH_PATH_PATTERN,
    'testbench preview'
  );
  const expectsVivadoImportTcl = artifactPaths.some((entry) =>
    VIVADO_IMPORT_TCL_PATTERN.test(entry)
  );

  const previewTop = await readPreviewByPath(page, previewTopPath);
  const previewXdc = await readPreviewByPath(page, previewXdcPath);
  const previewTestbench = await readPreviewByPath(page, previewTestbenchPath);

  assert(previewTop.length > 0, `${previewTopPath} preview must not be empty`);
  assert(previewXdc.length > 0, `${previewXdcPath} preview must not be empty`);
  assert(previewTestbench.length > 0, `${previewTestbenchPath} preview must not be empty`);

  const downloadButton = page.locator('[data-testid="ide-export-rebuild-btn"]').first();
  assert(await downloadButton.isVisible().catch(() => false), 'download Vivado Kit button must be visible');
  assert(
    !(await downloadButton.isDisabled().catch(() => true)),
    'download Vivado Kit button must be enabled'
  );

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    downloadButton.click(),
  ]);

  const downloadFailure = await download.failure();
  assert(!downloadFailure, `download failed: ${downloadFailure}`);

  const outDir = path.join(process.cwd(), 'out', 'gates');
  await fs.mkdir(outDir, { recursive: true });
  const zipPath = path.join(outDir, 'ide-export-e2e-contract.zip');
  await download.saveAs(zipPath);
  const zipBytes = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBytes);
  const zipPaths = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
  assert(zipPaths.length > 0, 'downloaded Vivado Kit ZIP must contain files');

  const topZipPath = requireZipPath(zipPaths, HDL_PATH_PATTERN, 'top HDL in ZIP');
  const xdcZipPath = requireZipPath(zipPaths, XDC_PATH_PATTERN, 'constraints XDC in ZIP');
  const testbenchZipPath = requireZipPath(zipPaths, TESTBENCH_PATH_PATTERN, 'testbench in ZIP');

  const readmeZipPath = zipPaths.find((entry) => README_PATH_PATTERN.test(entry));
  if (!readmeZipPath) {
    console.warn('[ide-export-e2e-contract] README.txt not found in ZIP (optional)');
  }

  if (expectsVivadoImportTcl) {
    requireZipPath(zipPaths, VIVADO_IMPORT_TCL_PATTERN, 'vivado_import.tcl in ZIP');
  }

  const topZipText = normalizeText(await zip.file(topZipPath)?.async('string'));
  const xdcZipText = normalizeText(await zip.file(xdcZipPath)?.async('string'));
  const testbenchZipText = normalizeText(await zip.file(testbenchZipPath)?.async('string'));

  assert(topZipText === previewTop, `${previewTopPath} preview must equal ${topZipPath} from ZIP`);
  assert(xdcZipText === previewXdc, `${previewXdcPath} preview must equal ${xdcZipPath} from ZIP`);
  assert(
    testbenchZipText === previewTestbench,
    `${previewTestbenchPath} preview must equal ${testbenchZipPath} from ZIP`
  );

  const projectPath = requireZipPath(zipPaths, PROJECT_RBPROJ_PATTERN, 'project.rbproj.json in ZIP');
  const projectText = await zip.file(projectPath)?.async('string');
  assert(Boolean(projectText), 'project.rbproj.json must be readable from ZIP');

  let parsedProject;
  try {
    parsedProject = JSON.parse(projectText ?? '{}');
  } catch {
    throw new Error('project.rbproj.json must contain valid JSON');
  }

  const mappedRows = extractMappedIoRows(parsedProject);
  assert(mappedRows.length > 0, 'project fixture must have at least one mapped I/O row');

  const xdcPinRows = parseXdcPackagePinRows(xdcZipText);
  assert(xdcPinRows.length > 0, 'XDC must contain PACKAGE_PIN rows');

  const expectedPortNames = new Set(mappedRows.map((entry) => entry.portName));
  const xdcPortNames = new Set(xdcPinRows.map((entry) => entry.portName));

  for (const portName of expectedPortNames) {
    assert(
      xdcPortNames.has(portName),
      `XDC missing PACKAGE_PIN mapping for expected mapped port "${portName}"`
    );
  }

  for (const portName of xdcPortNames) {
    assert(
      expectedPortNames.has(portName),
      `XDC references unexpected mapped port "${portName}" not present in project state`
    );
  }
});

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function clickVerifyRun(page) {
  const selectors = [
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    return;
  }
  throw new Error('verify run button was not visible in any supported state');
}

async function readPreviewByPath(page, artifactPath) {
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

  const preview = await page.locator('[data-testid="ide-export-preview-code"]').first().textContent().catch(() => '');
  return normalizeText(preview);
}

function requireArtifactPath(paths, pattern, label) {
  const match = paths.find((entry) => pattern.test(entry));
  assert(Boolean(match), `missing required artifact tab: ${label}`);
  return match;
}

function requireZipPath(paths, pattern, label) {
  const exact = paths.find((entry) => pattern.test(entry));
  if (exact) return exact;
  const fallback = paths.find((entry) => pattern.test(path.posix.basename(entry)));
  assert(Boolean(fallback), `missing required ZIP artifact: ${label}`);
  return fallback;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function extractMappedIoRows(project) {
  const inputs = Array.isArray(project?.ioMapping?.inputs) ? project.ioMapping.inputs : [];
  const outputs = Array.isArray(project?.ioMapping?.outputs) ? project.ioMapping.outputs : [];
  const rows = [...inputs, ...outputs];

  return rows
    .filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const pin = typeof entry.pin === 'string' ? entry.pin.trim() : '';
      const nodeId = typeof entry.nodeId === 'string' ? entry.nodeId.trim() : '';
      const port = typeof entry.port === 'string' ? entry.port.trim() : '';
      return pin.length > 0 && nodeId.length > 0 && port.length > 0;
    })
    .map((entry) => ({
      nodeId: entry.nodeId.trim(),
      port: entry.port.trim(),
      portName: sanitizeIdentifier(`${entry.nodeId}_${entry.port}`),
    }));
}

function sanitizeIdentifier(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1');
}

function parseXdcPackagePinRows(xdcText) {
  const rows = [];
  const regex =
    /set_property\s+-dict\s+\{\s*PACKAGE_PIN\s+([A-Za-z0-9]+)\s+IOSTANDARD\s+[A-Za-z0-9_]+\s*\}\s+\[get_ports\s+\{([^}]+)\}\]/gi;

  let match;
  while ((match = regex.exec(xdcText)) !== null) {
    rows.push({
      packagePin: String(match[1] ?? '').trim().toUpperCase(),
      portName: String(match[2] ?? '').trim(),
    });
  }

  return rows;
}
