import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

type Finding = {
  workflow: string;
  surface: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  note: string;
};

async function ensureArtifactDirs(): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
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

async function openMode(page: Page, mode: 'project' | 'design' | 'verify' | 'hardware' | 'export'): Promise<void> {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
}

async function openImport(page: Page): Promise<void> {
  await page.goto('/?mode=import', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-mode-import')).toBeVisible({ timeout: 30_000 });
  await dismissIntroChrome(page);
}

async function capture(page: Page, name: string): Promise<string> {
  const filename = `${name}.png`;
  const target = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: target, fullPage: true });
  return path.relative(process.cwd(), target).replace(/\\/g, '/');
}

async function loadExample(page: Page, exampleId: string): Promise<void> {
  await openProject(page);
  const landingExample = page.getByTestId(`ide-project-landing-example-${exampleId}`);
  if ((await landingExample.count()) > 0) {
    await landingExample.click();
  } else {
    const browserExample = page.getByTestId(`ide-project-load-start-${exampleId}`);
    if ((await browserExample.count()) === 0) {
      await page.getByTestId('ide-project-landing-example-logic-gates').click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      await openMode(page, 'project');
    }
    await page.getByTestId(`ide-project-load-start-${exampleId}`).click();
  }
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
}

async function runCompare(page: Page, expectedEvidence: RegExp): Promise<void> {
  await openMode(page, 'verify');
  await expect(page.getByTestId('ide-vcb-use-saved-checks')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-vcb-evidence')).toHaveText(expectedEvidence, {
    timeout: 30_000,
  });
}

function attachConsoleCapture(page: Page, findings: Finding[]): string[] {
  const severeMessages: string[] = [];

  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      !text.includes('Failed to load resource: the server responded with a status of 404')
    ) {
      severeMessages.push(text);
      findings.push({
        workflow: 'browser console',
        surface: 'global',
        severity: 'P1',
        note: text,
      });
    }
    if (text.includes('[CircuitStore] Circuit mutation called but engines not connected!')) {
      severeMessages.push(text);
      findings.push({
        workflow: 'browser console',
        surface: 'global',
        severity: 'P1',
        note: text,
      });
    }
  });

  page.on('pageerror', (error) => {
    const text = `pageerror: ${error.message}`;
    severeMessages.push(text);
    findings.push({
      workflow: 'browser page error',
      surface: 'global',
      severity: 'P0',
      note: text,
    });
  });

  return severeMessages;
}

test.describe('ECE141 product immersion workflows', () => {
  test.beforeEach(async () => {
    await ensureArtifactDirs();
  });

  test('empty project and six-surface audit loop captures course surfaces', async ({ page }) => {
    const findings: Finding[] = [];
    const severeMessages = attachConsoleCapture(page, findings);
    const screenshots: string[] = [];

    await openProject(page);
    screenshots.push(await capture(page, 'surface-project-launch'));

    await page.getByTestId('ide-project-build-fresh-primary').click();
    await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
    screenshots.push(await capture(page, 'workflow-empty-design'));

    await openMode(page, 'verify');
    screenshots.push(await capture(page, 'workflow-empty-verify'));

    await openMode(page, 'hardware');
    screenshots.push(await capture(page, 'workflow-empty-hardware'));
    await expect(page.getByText(/Add inputs and outputs in Design/i).first()).toBeVisible({ timeout: 30_000 });

    await openMode(page, 'export');
    screenshots.push(await capture(page, 'workflow-empty-export'));
    await expect(page.getByText(/Resolve all mapping and export issues|download unavailable|Draft export/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await openImport(page);
    screenshots.push(await capture(page, 'surface-import-entry'));
    await expect(page.getByTestId('ide-import-workflow-rail')).toBeVisible({ timeout: 30_000 });

    await writeFile(
      path.join(ARTIFACT_ROOT, 'empty-project-findings.json'),
      JSON.stringify({ screenshots, findings }, null, 2),
      'utf8',
    );

    expect(severeMessages).toEqual([]);
  });

  test('Logic Gates starter completes Verify Compare and Export readiness', async ({ page }) => {
    const findings: Finding[] = [];
    const severeMessages = attachConsoleCapture(page, findings);
    const screenshots: string[] = [];

    await loadExample(page, 'logic-gates');
    screenshots.push(await capture(page, 'logic-gates-design'));

    await runCompare(page, /12\/12 match/i);
    screenshots.push(await capture(page, 'logic-gates-verify-pass'));

    await openMode(page, 'hardware');
    await expect(page.getByTestId('ide-hw-map-table')).toBeVisible({ timeout: 30_000 });
    screenshots.push(await capture(page, 'logic-gates-map-pins'));

    await openMode(page, 'export');
    await expect(page.getByText(/Export Ready to Build/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Vivado package ready to build/i).first()).toBeVisible({ timeout: 30_000 });
    screenshots.push(await capture(page, 'logic-gates-export-ready'));

    await writeFile(
      path.join(ARTIFACT_ROOT, 'logic-gates-findings.json'),
      JSON.stringify({ screenshots, findings }, null, 2),
      'utf8',
    );

    expect(severeMessages).toEqual([]);
  });

  test('Half Adder starter completes Verify Compare and keeps Export evidence tiers honest', async ({ page }) => {
    const findings: Finding[] = [];
    const severeMessages = attachConsoleCapture(page, findings);
    const screenshots: string[] = [];

    await loadExample(page, 'half-adder');
    screenshots.push(await capture(page, 'half-adder-design'));

    await runCompare(page, /8\/8 match/i);
    screenshots.push(await capture(page, 'half-adder-verify-pass'));

    await openMode(page, 'hardware');
    await expect(page.getByTestId('ide-hw-map-table')).toBeVisible({ timeout: 30_000 });
    screenshots.push(await capture(page, 'half-adder-map-pins'));

    await openMode(page, 'export');
    await expect(page.getByText(/Export Ready to Build/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-export-vivado-evidence-rows')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/Export package/i);
    await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
    await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
    await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);
    await expect(page.getByText(/Download trusted Vivado package and program board/i)).toHaveCount(0);
    screenshots.push(await capture(page, 'half-adder-export-evidence'));

    await writeFile(
      path.join(ARTIFACT_ROOT, 'half-adder-findings.json'),
      JSON.stringify({ screenshots, findings }, null, 2),
      'utf8',
    );

    expect(severeMessages).toEqual([]);
  });

  test('Counter and advanced starter workflows expose sequential and deferred boundaries', async ({ page }) => {
    const findings: Finding[] = [];
    const severeMessages = attachConsoleCapture(page, findings);
    const screenshots: string[] = [];

    await loadExample(page, 'two-bit-counter');
    screenshots.push(await capture(page, 'two-bit-counter-design'));

    await openMode(page, 'verify');
    await expect(page.getByText(/CLK100MHZ runs automatically/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Auto board clock/i).first()).toBeVisible({ timeout: 30_000 });
    if ((await page.getByTestId('ide-verify-clock-policy-panel').count()) === 0) {
      findings.push({
        workflow: '2-Bit Up Counter',
        surface: 'Verify',
        severity: 'P2',
        note: 'Standard course flow shows Auto board clock summary, but the fuller clock policy panel is not visible before the run.',
      });
    }
    screenshots.push(await capture(page, 'two-bit-counter-verify-clock'));

    try {
      await page.getByTestId('ide-vcb-use-saved-checks').click({ timeout: 5_000 });
      await page.getByTestId('ide-vcb-run').click({ timeout: 5_000 });
      await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
    } catch (error) {
      findings.push({
        workflow: '2-Bit Up Counter Compare',
        surface: 'Verify',
        severity: 'P2',
        note: error instanceof Error ? error.message : String(error),
      });
    }
    screenshots.push(await capture(page, 'two-bit-counter-verify-after-run'));

    await openMode(page, 'export');
    await expect(page.getByText(/Vivado package/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
    screenshots.push(await capture(page, 'two-bit-counter-export'));

    await openMode(page, 'project');
    const advancedStarter = page.getByTestId('ide-project-load-start-23_lab8-fsm-lock-starter-basys3');
    if ((await advancedStarter.count()) > 0) {
      await advancedStarter.click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      screenshots.push(await capture(page, 'fsm-lock-design'));
      await openMode(page, 'verify');
      screenshots.push(await capture(page, 'fsm-lock-verify'));
    } else {
      findings.push({
        workflow: 'FSM lock starter',
        surface: 'Project',
        severity: 'P4',
        note: 'Advanced FSM lock starter was not visible in the primary landing examples.',
      });
    }

    await writeFile(
      path.join(ARTIFACT_ROOT, 'sequential-findings.json'),
      JSON.stringify({ screenshots, findings }, null, 2),
      'utf8',
    );

    expect(severeMessages).toEqual([]);
  });
});
