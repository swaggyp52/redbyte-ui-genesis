import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'sprint7-ui-hierarchy-2',
);

type Surface =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';

type Role = 'primary' | 'context' | 'advanced' | 'next';

async function ensureScreenshotDir(): Promise<void> {
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

async function openMode(
  page: Page,
  mode: 'project' | 'design' | 'verify' | 'hardware' | 'export',
): Promise<void> {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
}

function layer(page: Page, surface: Surface, role: Role): Locator {
  return page.locator(`[data-hierarchy-surface="${surface}"][data-hierarchy-role="${role}"]`).first();
}

async function expectLayerVisible(page: Page, surface: Surface, role: Role): Promise<Locator> {
  const locator = layer(page, surface, role);
  await expect(locator, `${surface} ${role} hierarchy layer`).toBeVisible({ timeout: 30_000 });
  return locator;
}

async function expectNextAction(page: Page, surface: Surface): Promise<void> {
  const next = await expectLayerVisible(page, surface, 'next');
  await expect(next, `${surface} next action should be enabled or actionable`).toBeEnabled();
}

async function expectAdvancedSecondary(page: Page, surface: Surface): Promise<void> {
  const advanced = await expectLayerVisible(page, surface, 'advanced');
  const isSecondary = await advanced.evaluate((node) => {
    if (node instanceof HTMLDetailsElement) {
      return !node.open;
    }

    const ariaExpanded = node.getAttribute('aria-expanded');
    const dataOpen = node.getAttribute('data-open');
    const style = window.getComputedStyle(node);

    return (
      node.hasAttribute('hidden') ||
      ariaExpanded === 'false' ||
      dataOpen === 'false' ||
      style.opacity === '0' ||
      style.display === 'none' ||
      style.visibility === 'hidden'
    );
  });
  expect(isSecondary, `${surface} advanced layer should be collapsed or visually secondary`).toBe(true);
}

async function expectSurfaceHierarchy(page: Page, surface: Surface): Promise<void> {
  await expectLayerVisible(page, surface, 'primary');
  await expectLayerVisible(page, surface, 'context');
  await expectAdvancedSecondary(page, surface);
  await expectNextAction(page, surface);
}

async function capture(page: Page, filename: string): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true,
  });
}

async function runSavedCompare(page: Page): Promise<void> {
  await openMode(page, 'verify');
  await expect(page.getByTestId('ide-vcb-use-saved-checks')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-vcb-evidence')).toHaveText(/12\/12 match/i, {
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

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  return failures;
}

test.describe('ECE141 UI hierarchy sprint 2', () => {
  test.beforeEach(async ({ page }) => {
    await ensureScreenshotDir();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('each RedByte surface exposes one focal object, context layer, secondary advanced layer, and next action', async ({ page }) => {
    const consoleFailures = captureConsoleFailures(page);

    await openProject(page);
    await expectSurfaceHierarchy(page, 'project');
    await expect(layer(page, 'project', 'primary')).toContainText(/Logic Gates/i);
    await expect(layer(page, 'project', 'advanced')).toContainText(/All lab starters/i);
    await capture(page, 'redbyte-project-hierarchy.png');

    await page.getByTestId('ide-project-landing-example-logic-gates').click();
    await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
    await expectSurfaceHierarchy(page, 'design');
    await expect(layer(page, 'design', 'primary')).toHaveAttribute('data-hierarchy-focal', 'circuit-canvas');
    await expect(
      layer(page, 'design', 'primary').locator('[data-node-id]').first(),
    ).toBeVisible({ timeout: 30_000 });
    await capture(page, 'redbyte-design-hierarchy.png');

    await openMode(page, 'verify');
    await expectSurfaceHierarchy(page, 'verify');
    await expect(layer(page, 'verify', 'primary')).toContainText(/Compare|Run|Latest run|Checks/i);
    await capture(page, 'redbyte-verify-before-run-hierarchy.png');

    await runSavedCompare(page);
    await expectSurfaceHierarchy(page, 'verify');
    await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
    await capture(page, 'redbyte-verify-pass-hierarchy.png');

    await openMode(page, 'hardware');
    await expectSurfaceHierarchy(page, 'hardware');
    await expect(layer(page, 'hardware', 'primary')).toContainText(/Basys3|Map Pins|SW|LD/i);
    await expect(page.getByTestId('ide-hw-map-board')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('ide-hw-map-board').scrollIntoViewIfNeeded();
    await capture(page, 'redbyte-hardware-map-pins-hierarchy.png');

    await openMode(page, 'export');
    await expectSurfaceHierarchy(page, 'export');
    await expect(layer(page, 'export', 'primary')).toContainText(/E0|Handoff|Export|package/i);
    await layer(page, 'export', 'primary').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/export\/package evidence only/i);
    await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
    await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
    await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);
    await capture(page, 'redbyte-export-e0-ready-hierarchy.png');

    await page.goto('/?mode=import', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ide-mode-import')).toBeVisible({ timeout: 30_000 });
    await dismissIntroChrome(page);
    await expectSurfaceHierarchy(page, 'import');
    await expect(layer(page, 'import', 'primary')).toContainText(/Import|Restore|ZIP|project/i);
    await capture(page, 'redbyte-import-recovery-hierarchy.png');

    expect(consoleFailures).toEqual([]);
  });

  test('narrow viewport keeps the same hierarchy without horizontal overflow', async ({ page }) => {
    const consoleFailures = captureConsoleFailures(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await openProject(page);
    await expectSurfaceHierarchy(page, 'project');

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > window.innerWidth + 2 ||
      document.body.scrollWidth > window.innerWidth + 2
    ));
    expect(hasHorizontalOverflow).toBe(false);
    await capture(page, 'redbyte-narrow-viewport-hierarchy.png');

    expect(consoleFailures).toEqual([]);
  });
});
