import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'sprint6-ui-art-direction',
);

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

test.describe('ECE141 UI art direction structure', () => {
  test.beforeEach(async ({ page }) => {
    await ensureScreenshotDir();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('RedByte lab workbench hierarchy keeps core workflow visible', async ({ page }) => {
    const consoleFailures = captureConsoleFailures(page);

    await openProject(page);
    await expect(page.getByTestId('ide-proof-ribbon')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-lab-flow-map')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-proof-ribbon-evidence')).toContainText(/E0 only/i);
    await expect(page.getByTestId('ide-proof-ribbon-evidence')).toContainText(/E1-E3 external/i);

    const starterPath = [
      page.getByTestId('ide-project-landing-example-logic-gates'),
      page.getByTestId('ide-project-landing-example-half-adder'),
      page.getByTestId('ide-project-landing-example-two-bit-counter'),
    ];
    for (const starter of starterPath) {
      await expect(starter).toBeVisible({ timeout: 30_000 });
    }
    const starterOrderIsDomOrdered = await page.evaluate(() => {
      const ids = [
        'ide-project-landing-example-logic-gates',
        'ide-project-landing-example-half-adder',
        'ide-project-landing-example-two-bit-counter',
      ];
      const cards = ids.map((id) => document.querySelector(`[data-testid="${id}"]`));
      if (cards.some((card) => !card)) return false;
      return cards.every((card, index) => {
        const next = cards[index + 1];
        if (!next) return true;
        return Boolean(card!.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
    });
    expect(starterOrderIsDomOrdered).toBe(true);
    await capture(page, 'redbyte-project-course-path.png');

    await page.getByTestId('ide-project-landing-example-logic-gates').click();
    await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-design-canvas')).toBeVisible({ timeout: 30_000 });
    await capture(page, 'redbyte-design-workbench.png');

    await runSavedCompare(page);
    await expect(page.getByTestId('ide-proof-step-verify')).toContainText(/Compare PASS/i);
    await capture(page, 'redbyte-verify-pass-state.png');

    await openMode(page, 'hardware');
    await expect(page.getByTestId('ide-hw-board-workspace')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-hw-map-table')).toBeVisible({ timeout: 30_000 });
    await capture(page, 'redbyte-hardware-map-pins.png');

    await openMode(page, 'export');
    await expect(page.getByTestId('ide-export-readiness-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ide-proof-step-export')).toContainText(/E0 ready|Draft|Stale E0/i);
    await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/export\/package evidence only/i);
    await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
    await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
    await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);
    await expect(page.getByTestId('ide-export-readiness-hero')).not.toContainText(/observed physical board/i);
    await capture(page, 'redbyte-export-e0-ready.png');

    await page.goto('/?mode=import', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ide-mode-import')).toBeVisible({ timeout: 30_000 });
    await dismissIntroChrome(page);
    await expect(page.getByTestId('ide-import-workflow-rail')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Nothing replaces your current project until you review the import/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await capture(page, 'redbyte-import-recovery.png');

    expect(consoleFailures).toEqual([]);
  });

  test('narrow viewport preserves a usable lab flow without horizontal overflow', async ({ page }) => {
    const consoleFailures = captureConsoleFailures(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await openProject(page);
    await expect(page.getByTestId('ide-lab-flow-map')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mode-button-project')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mode-button-verify')).toBeVisible({ timeout: 30_000 });

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > window.innerWidth + 2 ||
      document.body.scrollWidth > window.innerWidth + 2
    ));
    expect(hasHorizontalOverflow).toBe(false);
    await capture(page, 'redbyte-narrow-viewport.png');

    expect(consoleFailures).toEqual([]);
  });
});
