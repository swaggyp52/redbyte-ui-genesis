import { expect, test, type Locator, type Page } from '@playwright/test';

const VIEWPORT = { width: 1366, height: 768 } as const;

type BoxMeasurement = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
  readonly visibleWidth: number;
  readonly visibleHeight: number;
  readonly visibleAreaRatio: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
};

async function dismissIntroChrome(page: Page): Promise<void> {
  await page.getByTestId('ide-onboarding-skip').click({ timeout: 1_500 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss/i }).click({ timeout: 1_500 }).catch(() => {});
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

async function runSavedCompare(page: Page): Promise<void> {
  await openMode(page, 'verify');
  await expect(page.getByTestId('ide-vcb-use-saved-checks')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
  await resetViewportScroll(page);
}

async function measure(locator: Locator): Promise<BoxMeasurement> {
  await expect(locator.first()).toBeVisible({ timeout: 30_000 });
  return locator.first().evaluate((node) => {
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
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    };
  });
}

async function expectNoRootHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    windowWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(
    Math.max(overflow.documentWidth, overflow.bodyWidth),
    `${label}: root horizontal overflow ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.windowWidth + 2);
}

async function expectNoHorizontalOverflow(locator: Locator, label: string): Promise<void> {
  const box = await measure(locator);
  expect(
    box.scrollWidth,
    `${label}: scrollWidth=${box.scrollWidth}, clientWidth=${box.clientWidth}`,
  ).toBeLessThanOrEqual(box.clientWidth + 2);
}

async function clippedText(locator: Locator): Promise<string[]> {
  await expect(locator.first()).toBeVisible({ timeout: 30_000 });
  return locator.first().evaluate((node) => (
    Array.from(node.querySelectorAll<HTMLElement>('button,span,p,strong,code,summary,div'))
      .filter((child) => {
        const text = child.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (text.length < 3) return false;
        const rect = child.getBoundingClientRect();
        const style = window.getComputedStyle(child);
        const visible = rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none';
        return visible && (child.scrollWidth > child.clientWidth + 2 || child.scrollHeight > child.clientHeight + 2);
      })
      .slice(0, 8)
      .map((child) => child.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '')
  ));
}

async function expectFirstViewport(locator: Locator, label: string, minAreaRatio: number): Promise<BoxMeasurement> {
  const box = await measure(locator);
  expect(
    box.visibleAreaRatio,
    `${label}: visible ratio ${box.visibleAreaRatio.toFixed(2)} for ${JSON.stringify(box)}`,
  ).toBeGreaterThanOrEqual(minAreaRatio);
  return box;
}

async function visibleScrollContainerCount(page: Page): Promise<number> {
  return page.evaluate(() => (
    Array.from(document.querySelectorAll('*')).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const visible = rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.top < window.innerHeight && style.visibility !== 'hidden' && style.display !== 'none';
      const canScroll = (
        (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) ||
        (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2)
      );
      return visible && canScroll;
    }).length
  ));
}

test.describe('ECE141 visual system integrity', () => {
  test.use({ viewport: VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('rb-onboarding-v1-seen', '1');
    });
  });

  test('Project and Design keep first-viewport work areas bounded', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await openMode(page, 'project');
    await expectNoRootHorizontalOverflow(page, 'Project loaded state');
    await expectFirstViewport(page.getByTestId('ide-project-command-strip'), 'Project command strip', 0.9);
    expect(await visibleScrollContainerCount(page), 'Project should not create nested scroll noise').toBeLessThanOrEqual(2);

    await openMode(page, 'design');
    await expectNoRootHorizontalOverflow(page, 'Design starter state');
    const canvas = await expectFirstViewport(page.getByTestId('ide-design-live-canvas'), 'Design live canvas', 0.9);
    expect(canvas.visibleWidth * canvas.visibleHeight, 'Design canvas should occupy a meaningful laptop workbench area').toBeGreaterThan(300_000);
  });

  test('Verify command and evidence regions do not clip core run state', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await runSavedCompare(page);

    await expectNoRootHorizontalOverflow(page, 'Verify pass state');
    await expectNoHorizontalOverflow(page.getByTestId('ide-verify-region-header'), 'Verify header region');
    await expectFirstViewport(page.getByTestId('ide-verify-region-waveform'), 'Verify waveform region', 0.9);
    await expectFirstViewport(page.getByTestId('ide-verify-waveform-svg'), 'Verify waveform SVG', 0.6);

    const clipped = await clippedText(page.getByTestId('ide-verify-command-bar'));
    expect(clipped, `Verify command bar clipped core text: ${clipped.join(' | ')}`).toEqual([]);
  });

  test('Hardware keeps the guide readable while board mapping remains visible', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await openMode(page, 'hardware');

    await expectNoRootHorizontalOverflow(page, 'Hardware Map Pins state');
    await expectFirstViewport(page.getByTestId('ide-hw-map-table'), 'Hardware mapping table', 0.7);
    await expectFirstViewport(page.getByTestId('ide-hw-map-board'), 'Hardware Basys3 board', 0.65);

    const authority = await measure(page.getByTestId('ide-hw-map-dock-authority-sub'));
    expect(authority.width, 'Hardware guide copy should keep a readable line width').toBeGreaterThanOrEqual(120);
    expect(authority.scrollWidth, 'Hardware guide copy should not horizontally overflow').toBeLessThanOrEqual(authority.clientWidth + 2);
  });

  test('Export draft and ready states keep trust, evidence, and handoff visible', async ({ page }) => {
    await loadLogicGatesStarter(page);
    await openMode(page, 'export');

    await expectNoRootHorizontalOverflow(page, 'Export draft state');
    const draftRail = await page.getByTestId('ide-proof-step-export').innerText();
    expect(draftRail, `Draft Export rail should not claim ready-to-build: "${draftRail}"`).not.toMatch(/Ready to build/i);
    await expectFirstViewport(page.getByTestId('ide-export-rebuild-btn'), 'Export draft primary repair/build action', 0.95);
    await expectFirstViewport(page.getByTestId('ide-export-vivado-evidence-diagnostics'), 'Export draft evidence diagnostics', 0.45);

    await runSavedCompare(page);
    await openMode(page, 'export');

    await expectNoRootHorizontalOverflow(page, 'Export ready state');
    await expectFirstViewport(page.getByTestId('ide-export-rebuild-btn'), 'Export ready primary action', 0.95);
    await expectFirstViewport(page.getByTestId('ide-export-vivado-evidence-diagnostics'), 'Export ready evidence diagnostics', 0.45);
    await expectFirstViewport(page.getByTestId('ide-export-handoff-summary'), 'Export ready handoff summary', 0.2);

    const clipped = await clippedText(page.getByTestId('ide-export-readiness-hero'));
    expect(clipped, `Export readiness hero clipped text: ${clipped.join(' | ')}`).toEqual([]);
  });
});
