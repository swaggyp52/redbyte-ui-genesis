import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const VIEWPORT = { width: 1366, height: 768 } as const;
const DEFAULT_CAPTURE_DIR = path.join(
  '.redbyte',
  'product-immersion',
  'first-viewport-repair',
  'current',
);

type ViewportMeasurement = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
  readonly visibleWidth: number;
  readonly visibleHeight: number;
  readonly visibleAreaRatio: number;
};

function captureDir(): string {
  const configured = process.env.RB_FIRST_VIEWPORT_CAPTURE_DIR ?? DEFAULT_CAPTURE_DIR;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

async function capture(page: Page, name: string): Promise<void> {
  const dir = captureDir();
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: false,
  });
}

async function resetViewportScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const scrollOwners = [
      document.scrollingElement,
      ...document.querySelectorAll<HTMLElement>(
        '.ide-workbench-workspace, .ide-panel-body, [data-testid="ide-mode-body"]',
      ),
    ].filter(Boolean);
    for (const node of scrollOwners) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
  });
}

async function dismissIntroChrome(page: Page): Promise<void> {
  await page.getByTestId('ide-onboarding-skip').click({ timeout: 1_500 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss/i }).click({ timeout: 1_500 }).catch(() => {});
}

async function openProject(page: Page): Promise<void> {
  await page.goto('/?mode=project&e2e=1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });
  await dismissIntroChrome(page);
  await expect(page.getByTestId('ide-mode-project')).toBeVisible({ timeout: 30_000 });
  await resetViewportScroll(page);
}

async function openMode(
  page: Page,
  mode: 'project' | 'design' | 'verify' | 'hardware' | 'export',
): Promise<void> {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
  await resetViewportScroll(page);
}

async function loadLogicGatesStarter(page: Page): Promise<void> {
  await openProject(page);
  await page.getByTestId('ide-project-landing-example-logic-gates').click();
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
  await resetViewportScroll(page);
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

async function measureViewport(locator: Locator): Promise<ViewportMeasurement> {
  const target = locator.first();
  await expect(target).toBeVisible({ timeout: 30_000 });
  return target.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const visibleLeft = Math.max(0, rect.left);
    const visibleRight = Math.min(window.innerWidth, rect.right);
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const area = Math.max(1, rect.width * rect.height);

    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      visibleWidth,
      visibleHeight,
      visibleAreaRatio: (visibleWidth * visibleHeight) / area,
    };
  });
}

async function expectFirstViewport(
  locator: Locator,
  label: string,
  options: {
    readonly minVisibleHeight?: number;
    readonly minVisibleWidth?: number;
    readonly minVisibleAreaRatio?: number;
  } = {},
): Promise<ViewportMeasurement> {
  const measurement = await measureViewport(locator);
  const minVisibleHeight = options.minVisibleHeight ?? 48;
  const minVisibleWidth = options.minVisibleWidth ?? 80;
  const minVisibleAreaRatio = options.minVisibleAreaRatio ?? 0.65;
  const details = `${label}: top=${measurement.top.toFixed(1)}, bottom=${measurement.bottom.toFixed(1)}, visible=${measurement.visibleWidth.toFixed(1)}x${measurement.visibleHeight.toFixed(1)}, ratio=${measurement.visibleAreaRatio.toFixed(2)}`;

  expect(measurement.visibleHeight, details).toBeGreaterThanOrEqual(minVisibleHeight);
  expect(measurement.visibleWidth, details).toBeGreaterThanOrEqual(minVisibleWidth);
  expect(measurement.visibleAreaRatio, details).toBeGreaterThanOrEqual(minVisibleAreaRatio);
  return measurement;
}

async function visibleText(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, ' ').trim();
}

test.describe('ECE141 first-viewport product contract', () => {
  test.use({ viewport: VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('rb-onboarding-v1-seen', '1');
    });
  });

  test('Project launch shows the recommended starter CTA in the first viewport', async ({ page }) => {
    await openProject(page);
    await capture(page, 'project-launch');

    await expectFirstViewport(page.getByTestId('ide-project-primary-actions'), 'Project primary launch actions', {
      minVisibleHeight: 88,
      minVisibleAreaRatio: 0.8,
    });
    await expectFirstViewport(page.getByTestId('ide-project-landing-example-logic-gates'), 'Project recommended Logic Gates CTA', {
      minVisibleHeight: 96,
      minVisibleAreaRatio: 0.75,
    });
  });

  test('Design starter opens with a meaningful canvas and graph visible', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await capture(page, 'design-logic-gates');

    await expectFirstViewport(page.getByTestId('ide-design-live-canvas'), 'Design live canvas', {
      minVisibleHeight: 320,
      minVisibleWidth: 520,
      minVisibleAreaRatio: 0.85,
    });
    await expectFirstViewport(page.locator('[data-node-id]').first(), 'Design first circuit node', {
      minVisibleHeight: 28,
      minVisibleWidth: 28,
      minVisibleAreaRatio: 0.75,
    });
  });

  test('Hardware Map Pins opens with the mapping workbench visible', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await openMode(page, 'hardware');
    await capture(page, 'hardware-map-pins');

    await expectFirstViewport(page.getByTestId('ide-hw-map-table'), 'Hardware mapping table', {
      minVisibleHeight: 260,
      minVisibleWidth: 240,
      minVisibleAreaRatio: 0.7,
    });
    await expectFirstViewport(page.getByTestId('ide-hw-map-board'), 'Hardware Basys3 board affordance', {
      minVisibleHeight: 220,
      minVisibleWidth: 420,
      minVisibleAreaRatio: 0.65,
    });
  });

  test('Export opens with one visible primary action and aligned trust wording', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await runSavedCompare(page);
    await openMode(page, 'export');
    await capture(page, 'export-ready-to-build');

    await expectFirstViewport(page.getByTestId('ide-export-rebuild-btn'), 'Export primary handoff action', {
      minVisibleHeight: 28,
      minVisibleWidth: 120,
      minVisibleAreaRatio: 0.95,
    });

    const commandText = await visibleText(page.getByTestId('ide-export-command-strip'));
    const railText = await visibleText(page.getByTestId('ide-proof-step-export'));
    expect(commandText, 'Export command strip should expose the current ready-to-build state').toMatch(/READY TO BUILD|READY|STALE|NEEDS REVIEW/i);
    expect(railText, `Export lab-flow rail conflicts with current handoff state: "${railText}"`).not.toMatch(/\bDraft\b/i);
  });
});
