import { expect, test, type Page } from '@playwright/test';

const VIEWPORT = { width: 1920, height: 1080 };
const IMAGE_ASSERT = {
  animations: 'disabled' as const,
  maxDiffPixelRatio: 0.0015,
};

test.describe('IDE screenshot baselines (authority surfaces)', () => {
  test.beforeEach(async ({ page }) => {
    await applyDeterministicInit(page);
    await page.setViewportSize(VIEWPORT);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('home authority hero baseline', async ({ page }) => {
    await page.goto('/?launcher=1&openApp=home', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
    await page.waitForSelector('[data-testid="home-start-here"]', { timeout: 20000 });
    await disableUiJitter(page);

    await expect(page.locator('[data-testid="home-start-here"]')).toHaveScreenshot(
      'home-authority-hero.png',
      IMAGE_ASSERT
    );
  });

  test('ide project baseline', async ({ page }) => {
    await gotoIdeMode(page, 'project');
    await expect(page.locator('[data-testid="ide-root"]')).toHaveScreenshot('ide-mode-project.png', IMAGE_ASSERT);
  });

  test('ide design baseline', async ({ page }) => {
    await gotoIdeMode(page, 'design');
    await expect(page.locator('[data-testid="ide-root"]')).toHaveScreenshot('ide-mode-design.png', IMAGE_ASSERT);
  });

  test('ide verify baseline', async ({ page }) => {
    await gotoIdeMode(page, 'verify');
    await expect(page.locator('[data-testid="ide-root"]')).toHaveScreenshot('ide-mode-verify.png', IMAGE_ASSERT);
  });

  test('ide export baseline', async ({ page }) => {
    await gotoIdeMode(page, 'export');
    await expect(page.locator('[data-testid="ide-root"]')).toHaveScreenshot('ide-mode-export.png', IMAGE_ASSERT);
  });

  test('ide import baseline', async ({ page }) => {
    await gotoIdeMode(page, 'import');
    await expect(page.locator('[data-testid="ide-root"]')).toHaveScreenshot('ide-mode-import.png', IMAGE_ASSERT);
  });
});

async function gotoIdeMode(
  page: Page,
  mode: 'project' | 'design' | 'verify' | 'export' | 'import'
): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 20000 });
  await disableUiJitter(page);

  if (mode !== 'project') {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 12000 });
  await page.waitForTimeout(120);
}

async function disableUiJitter(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html {
        scroll-behavior: auto !important;
      }
    `,
  });
}

async function applyDeterministicInit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();

    const fixedNow = Date.parse('2026-01-01T00:00:00.000Z');
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(fixedNow);
          return;
        }
        super(...args);
      }
      static now() {
        return fixedNow;
      }
    }

    Object.setPrototypeOf(FixedDate, NativeDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Date = FixedDate;
    Math.random = () => 0.123456789;
  });
}

