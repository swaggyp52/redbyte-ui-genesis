import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SPRINT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'sprint4-import-export-recovery',
);
const DOWNLOAD_DIR = path.join(SPRINT_ROOT, 'downloads');
const FIXTURE_DIR = path.join(SPRINT_ROOT, 'fixtures');

type ExportProbe = {
  readonly filePath: string;
  readonly suggestedFilename: string;
  readonly entries: string[];
  readonly projectManifest: Record<string, unknown>;
};

async function ensureArtifactDirs(): Promise<void> {
  await mkdir(DOWNLOAD_DIR, { recursive: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
}

async function dismissIntroChrome(page: Page): Promise<void> {
  await page.getByTestId('ide-onboarding-skip').click({ timeout: 1_500 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss/i }).click({ timeout: 1_500 }).catch(() => {});
}

async function openProject(page: Page): Promise<void> {
  await page.goto('/?mode=project', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });
  await dismissIntroChrome(page);
}

async function openImport(page: Page): Promise<void> {
  await page.goto('/?mode=import', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-mode-import')).toBeVisible({ timeout: 30_000 });
  await dismissIntroChrome(page);
}

async function openMode(
  page: Page,
  mode: 'project' | 'design' | 'verify' | 'hardware' | 'export',
): Promise<void> {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
}

async function loadExample(page: Page, exampleId: string): Promise<void> {
  await openProject(page);
  const landingExample = page.getByTestId(`ide-project-landing-example-${exampleId}`);
  if (await landingExample.isVisible().catch(() => false)) {
    await landingExample.click();
  } else {
    await openExamplesDisclosure(page);
    const pathStep = page.getByTestId(`ide-projectx-path-step-${exampleId}`);
    if (await pathStep.isVisible().catch(() => false)) {
      await pathStep.click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      return;
    }
    const browserExample = page.getByTestId(`ide-project-load-start-${exampleId}`);
    if (!(await browserExample.isVisible().catch(() => false))) {
      await page.getByTestId('ide-project-landing-example-logic-gates').click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      await openMode(page, 'project');
      await openExamplesDisclosure(page);
    }
    await browserExample.click();
  }
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
}

async function openExamplesDisclosure(page: Page): Promise<void> {
  const disclosure = page.getByTestId('ide-project-examples-disclosure');
  if ((await disclosure.count()) === 0) return;
  if ((await disclosure.getAttribute('data-expanded').catch(() => 'true')) === 'true') return;
  await page.getByTestId('ide-projectx-examples-toggle').click();
}

async function runSavedCompare(page: Page, expectedEvidence: RegExp): Promise<void> {
  await openMode(page, 'verify');
  await expect(page.getByTestId('ide-vcb-use-saved-checks')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-vcb-evidence')).toHaveText(expectedEvidence, {
    timeout: 30_000,
  });
}

function captureConsoleFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      !text.includes('Failed to load resource: the server responded with a status of 404')
    ) {
      failures.push(text);
    }
    if (text.includes('[CircuitStore] Circuit mutation called but engines not connected!')) {
      failures.push(text);
    }
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  return failures;
}

async function remapLogicGateSw0(page: Page, targetHitId = 'ide-hw-map-sw-2-hit'): Promise<void> {
  await openMode(page, 'hardware');
  await expect(page.getByTestId('ide-hw-map-row-sw0')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('ide-hw-map-row-sw0').click();
  await expect(page.getByTestId(targetHitId)).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(targetHitId).click();
  await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW2 \(pin W16\)/i);
}

async function expectE0OnlyExportEvidence(page: Page): Promise<void> {
  await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/export\/package evidence only/i);
  await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
  await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
  await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);
  await expect(page.getByTestId('ide-export-readiness-hero')).not.toContainText(/observed physical board/i);
}

async function downloadVivadoProject(page: Page, prefix: string): Promise<ExportProbe> {
  await openMode(page, 'export');
  await expectE0OnlyExportEvidence(page);

  const downloadPromise = page.waitForEvent('download');
  const secondaryProjectDownload = page.getByTestId('ide-export-dock-download');
  if ((await secondaryProjectDownload.count()) > 0 && await secondaryProjectDownload.isVisible()) {
    await secondaryProjectDownload.click();
  } else {
    await page.getByTestId('ide-export-rebuild-btn').click();
  }
  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toMatch(/vivado-project\.zip$/i);

  const filePath = path.join(DOWNLOAD_DIR, `${prefix}-${suggestedFilename}`);
  await download.saveAs(filePath);
  await expect(page.getByTestId('ide-export-download-success')).toBeVisible({ timeout: 30_000 });
  await expectE0OnlyExportEvidence(page);

  const zip = await JSZip.loadAsync(await readFile(filePath));
  const entries = Object.keys(zip.files).filter((entry) => !zip.files[entry].dir).sort();
  const manifestEntry = entries.find((entry) => entry.endsWith('/project.rbproj.json'));
  expect(manifestEntry).toBeTruthy();
  const manifestText = await zip.file(manifestEntry!)!.async('string');
  const projectManifest = JSON.parse(manifestText) as Record<string, unknown>;

  expect(entries.some((entry) => entry.endsWith('/README.txt'))).toBeTruthy();
  expect(entries.some((entry) => entry.endsWith('/vivado_import.tcl'))).toBeTruthy();
  expect(entries.some((entry) => entry.endsWith('/top.vhd'))).toBeTruthy();
  expect(entries.some((entry) => entry.endsWith('/top.xdc'))).toBeTruthy();
  expect(entries.some((entry) => entry.endsWith('.xpr'))).toBeTruthy();
  expect(projectManifest.kind).toBe('rb-project');
  expect(projectManifest.version).toBe(1);

  return {
    filePath,
    suggestedFilename,
    entries,
    projectManifest,
  };
}

async function createCorruptManifestZip(): Promise<string> {
  const zip = new JSZip();
  zip.file('broken/project.rbproj.json', '{"kind":"rb-project","version":1,"name":');
  zip.file(
    'broken/top.vhd',
    [
      'entity broken is',
      '  port (A : in std_logic; Y : out std_logic);',
      'end broken;',
      'architecture rtl of broken is begin Y <= A; end rtl;',
    ].join('\n'),
  );
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const filePath = path.join(FIXTURE_DIR, 'corrupt-redbyte-manifest.zip');
  await writeFile(filePath, bytes);
  return filePath;
}

test.describe('ECE141 import/export recovery workflows', () => {
  test.beforeEach(async () => {
    await ensureArtifactDirs();
  });

  test('ECE141 project persistence and stale evidence smoke @project-persistence', async ({ page }) => {
    const consoleFailures = captureConsoleFailures(page);

    await loadExample(page, 'logic-gates');
    await runSavedCompare(page, /12\/12 match/i);
    await remapLogicGateSw0(page);
    await openMode(page, 'export');
    await expectE0OnlyExportEvidence(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });
    await dismissIntroChrome(page);
    await openMode(page, 'hardware');
    await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW2 \(pin W16\)/i);
    await openMode(page, 'export');
    await expectE0OnlyExportEvidence(page);
    await expect(page.getByTestId('ide-export-download-success')).toHaveCount(0);

    await loadExample(page, 'two-bit-counter');
    await runSavedCompare(page, /14\/14 match/i);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });
    await dismissIntroChrome(page);
    await openMode(page, 'verify');
    await expect(page.getByTestId('ide-verify-clock-policy-panel')).toContainText(/CLK100MHZ/i);
    await openMode(page, 'export');
    await expectE0OnlyExportEvidence(page);

    expect(consoleFailures).toEqual([]);
  });

  test('ECE141 import/export recovery smoke @import-export-recovery', async ({ page }) => {
    const consoleFailures = captureConsoleFailures(page);

    await loadExample(page, 'logic-gates');
    await runSavedCompare(page, /12\/12 match/i);
    await remapLogicGateSw0(page);
    await runSavedCompare(page, /12\/12 match/i);
    const logicExport = await downloadVivadoProject(page, 'logic-gates');
    expect(logicExport.projectManifest.name).toMatch(/Logic Gates/i);

    await loadExample(page, 'two-bit-counter');
    await runSavedCompare(page, /14\/14 match/i);
    const counterExport = await downloadVivadoProject(page, 'two-bit-counter');
    expect(counterExport.projectManifest.name).toMatch(/2-Bit Up Counter/i);
    expect(counterExport.entries.some((entry) => /EXPECTED_IO\.json$/i.test(entry))).toBeTruthy();

    await openImport(page);
    await page.getByTestId('ide-import-zip-input').setInputFiles(logicExport.filePath);
    await expect(page.getByTestId('ide-import-zip-inspection')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-import-zip-mode')).toContainText(/RedByte manifest/i);
    await expect(page.getByTestId('ide-import-zip-authority')).toContainText(/one source of truth|embedded manifest/i);

    await page.getByTestId('ide-import-process-design').click();
    await expect(page.getByTestId('ide-import-commit-preview')).toBeVisible({ timeout: 30_000 });
    await page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('ide-import-apply-open-verify').click();
    await expect(page.getByTestId('ide-mode-verify')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-verify-pass-hero')).toHaveCount(0);
    await runSavedCompare(page, /12\/12 match/i);

    await openMode(page, 'hardware');
    await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW2 \(pin W16\)/i);
    await openMode(page, 'export');
    await expectE0OnlyExportEvidence(page);

    const corruptZip = await createCorruptManifestZip();
    await openImport(page);
    await page.getByTestId('ide-import-zip-input').setInputFiles(corruptZip);
    await expect(page.getByTestId('ide-import-zip-error')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('ide-import-zip-error').locator('summary').click();
    await expect(page.getByTestId('ide-import-zip-error')).toContainText(/No files were changed/i);

    await openMode(page, 'hardware');
    await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW2 \(pin W16\)/i);

    expect(consoleFailures).toEqual([]);
  });
});
