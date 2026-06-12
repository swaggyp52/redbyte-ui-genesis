import { expect, test, type Locator, type Page } from '@playwright/test';

const VIEWPORT = { width: 1366, height: 768 } as const;

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

type TextMeasurement = ViewportMeasurement & {
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly lineHeightPx: number;
  readonly estimatedLineCount: number;
  readonly text: string;
};

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

async function openMode(page: Page, mode: 'project' | 'design' | 'verify' | 'hardware' | 'export'): Promise<void> {
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

async function measureText(locator: Locator): Promise<TextMeasurement> {
  const target = locator.first();
  await expect(target).toBeVisible({ timeout: 30_000 });
  return target.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const computed = window.getComputedStyle(node);
    const lineHeightPx = Number.parseFloat(computed.lineHeight);
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
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      lineHeightPx,
      estimatedLineCount: Number.isFinite(lineHeightPx) && lineHeightPx > 0
        ? Math.round(rect.height / lineHeightPx)
        : 0,
      text: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
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
  const details = `${label}: visible=${measurement.visibleWidth.toFixed(1)}x${measurement.visibleHeight.toFixed(1)}, ratio=${measurement.visibleAreaRatio.toFixed(2)}`;

  expect(measurement.visibleHeight, details).toBeGreaterThanOrEqual(minVisibleHeight);
  expect(measurement.visibleWidth, details).toBeGreaterThanOrEqual(minVisibleWidth);
  expect(measurement.visibleAreaRatio, details).toBeGreaterThanOrEqual(minVisibleAreaRatio);
  return measurement;
}

test.describe('ECE141 Hardware visual credibility', () => {
  test.use({ viewport: VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('rb-onboarding-v1-seen', '1');
    });
  });

  test('Map Pins keeps the guide readable while the board workbench leads', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await openMode(page, 'hardware');

    const dock = await expectFirstViewport(page.getByTestId('ide-hw-map-dock'), 'Hardware Map Pins guide dock', {
      minVisibleHeight: 220,
      minVisibleWidth: 184,
      minVisibleAreaRatio: 0.9,
    });
    const authority = await measureText(page.getByTestId('ide-hw-map-dock-authority-sub'));
    const board = await expectFirstViewport(page.getByTestId('ide-hw-map-board'), 'Hardware Basys3 board affordance', {
      minVisibleHeight: 220,
      minVisibleWidth: 420,
      minVisibleAreaRatio: 0.65,
    });
    const table = await expectFirstViewport(page.getByTestId('ide-hw-map-table'), 'Hardware mapping table', {
      minVisibleHeight: 260,
      minVisibleWidth: 240,
      minVisibleAreaRatio: 0.7,
    });
    const exportAction = await expectFirstViewport(page.getByTestId('ide-hardware-map-dock-primary'), 'Hardware Open Export action', {
      minVisibleHeight: 28,
      minVisibleWidth: 100,
      minVisibleAreaRatio: 0.95,
    });

    expect(authority.width, `authority copy width ${authority.width.toFixed(1)}px in dock ${dock.width.toFixed(1)}px`).toBeGreaterThanOrEqual(120);
    expect(authority.estimatedLineCount, `authority copy wrapped into ${authority.estimatedLineCount} lines: "${authority.text}"`).toBeLessThanOrEqual(4);
    expect(authority.scrollWidth, 'authority copy should not horizontally overflow the dock').toBeLessThanOrEqual(authority.clientWidth + 1);

    const boardArea = board.width * board.height;
    const tableArea = table.width * table.height;
    const actionArea = exportAction.width * exportAction.height;
    expect(boardArea + tableArea, 'board/table must remain the focal work area over the secondary export action').toBeGreaterThan(actionArea * 40);
  });

  test('No-circuit Hardware state points students back to Design before mapping', async ({ page }) => {
    await openProject(page);
    await openMode(page, 'hardware');

    const dockText = await page.getByTestId('ide-hw-map-dock').innerText();
    expect(dockText).toMatch(/Design first/i);
    expect(dockText).toMatch(/Add inputs and outputs in Design/i);
  });
});
