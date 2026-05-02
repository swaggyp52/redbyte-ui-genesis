import { expect, test, type Page } from '@playwright/test';

async function suppressOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
}

test.describe('Board clock browser proof gate', () => {
  test('auto board clock default, manual override, and export testbench evidence', async ({ page }) => {
    await suppressOnboarding(page);

    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 60000 });

    await page.getByTestId('ide-project-landing-example-two-bit-counter').click();
    await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('mode-button-verify').click();
    await expect(page.getByTestId('ide-mode-verify')).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('ide-verify-clock-policy-panel')).toBeVisible();
    await expect(page.getByTestId('ide-verify-board-clock-source')).toContainText('CLK100MHZ');
    await expect(page.getByTestId('ide-verify-clock-mode-summary')).toContainText('Auto board clock');

    await expect(page.getByTestId('ide-stimulus-clock-row')).toHaveCount(0);

    await page.getByTestId('ide-vcb-run').click();
    await expect(page.getByTestId('ide-verify-scope-header')).toBeVisible({ timeout: 60000 });

    await page.getByTestId('ide-verify-clock-mode-manual').click();
    await expect(page.getByTestId('ide-verify-clock-mode-summary')).toContainText('Manual pulses');
    await expect(page.getByTestId('ide-stimulus-clock-row')).toBeVisible();

    await page.getByTestId('ide-verify-clock-mode-auto').click();
    await expect(page.getByTestId('ide-verify-clock-mode-summary')).toContainText('Auto board clock');
    await expect(page.getByTestId('ide-stimulus-clock-row')).toHaveCount(0);

    await page.getByTestId('mode-button-export').click();
    await expect(page.getByTestId('ide-mode-export')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('ide-export-artifact-tab-testbench-vhd').click();
    const previewCode = page.getByTestId('ide-export-preview-code');
    await expect(previewCode).toContainText('clock_gen');
    await expect(previewCode).toContainText('CLK_HALF_PERIOD');
    await expect(previewCode).toContainText('rising_edge(CLK100MHZ)');
  });
});
