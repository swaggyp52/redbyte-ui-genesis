import { test, expect, type Page } from '@playwright/test';

async function waitForShell(page: Page) {
  await page.goto('/os/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible({ timeout: 60_000 });
}

async function openLabStarterFromHome(page: Page) {
  await page.goto('/os/?openApp=home', { waitUntil: 'domcontentloaded' });

  const starterButton = page.locator('[data-testid="home-starter-wire-lamp"]');
  await expect(starterButton).toBeVisible({ timeout: 20_000 });
  await starterButton.dispatchEvent('click');

  await expect(page.locator('[data-testid="lab-workspace-root"]')).toBeVisible({ timeout: 60_000 });
}

test.describe('Classroom RC smoke', () => {
  test('boots and renders Home', async ({ page }) => {
    await waitForShell(page);
    await page.goto('/os/?openApp=home', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 20_000 });
  });

  test('opens Lab 1 starter in Lab Workspace from Home', async ({ page }) => {
    await waitForShell(page);
    await openLabStarterFromHome(page);
    await expect(page.locator('[data-testid="lab-workspace-header"]')).toContainText('Lab 1 - Basic Gate Operation', {
      timeout: 20_000,
    });
  });

  test('opens Submit tab and runs bundle generation action', async ({ page }) => {
    await waitForShell(page);
    await openLabStarterFromHome(page);

    await page.locator('[data-testid="lab-workspace-tab-submit"]').click();
    await expect(page.locator('[data-testid="lab-workspace-panel-submit"]')).toBeVisible({ timeout: 20_000 });

    const generateButton = page.locator('[data-testid="lab-workspace-generate-submission-bundle"]');
    await expect(generateButton).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => await generateButton.isDisabled(), { timeout: 30_000 })
      .toBe(false);

    await generateButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    const submitStatus = page.locator('[data-testid="lab-workspace-submit-status"]');
    await expect(submitStatus).toBeVisible({ timeout: 30_000 });
    await expect(submitStatus).toContainText(/submission bundle generated|warning|failed|error/i, { timeout: 30_000 });
  });
});
