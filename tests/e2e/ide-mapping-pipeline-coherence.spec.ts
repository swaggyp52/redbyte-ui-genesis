/**
 * Real localhost runtime proof: Verify → Project (Map Pins) → Hardware → Export
 * share one mapping truth. Uses preview server (playwright webServer on 4173).
 */
import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts');

test.describe('IDE mapping pipeline coherence (student journey)', () => {
  test('Flow A: signal-tour — map SW0 on Project, see same pin on Hardware and Export', async ({
    page,
  }, testInfo) => {
    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 60000 });

    // Load first landing example (signal-tour)
    await page.getByTestId('ide-project-landing-example-signal-tour').click();
    await expect(page.locator('[data-testid="ide-mode-design"]')).toBeVisible({ timeout: 30000 });

    // Verify
    await page.locator('[data-testid="mode-button-verify"]').click();
    await expect(page.locator('[data-testid="ide-mode-verify"]')).toBeVisible({ timeout: 15000 });
    const runBtn = page.getByTestId('ide-vcb-run');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
    }
    await page.waitForTimeout(800);

    // Project — Map Pins table (defaults expanded)
    await page.locator('[data-testid="mode-button-project"]').click();
    await expect(page.locator('[data-testid="ide-mode-project"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="ide-project-map-pins-header"]')).toBeVisible();

    const newPin = 'V18';
    const mapInput = page.locator('[data-testid="ide-project-map-input-sw0"]');
    await mapInput.click();
    await mapInput.fill(newPin);
    await mapInput.press('Tab');
    await expect(page.locator('[data-testid="ide-project-mapping-saved-feedback"]')).toBeVisible({
      timeout: 5000,
    });

    // Hardware — same truth (read-only row shows code.pin). Default stage may be
    // "Test on Board" when mapping is complete; Map Pins tab holds the authority callout.
    await page.locator('[data-testid="mode-button-hardware"]').click();
    await expect(page.locator('[data-testid="ide-mode-hardware"]')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ide-hw-mode-btn-map').click();
    await expect(page.locator('[data-testid="ide-hw-map-authority-callout"]')).toBeVisible();
    const hwRow = page.locator('[data-testid="ide-hw-map-row-sw0"]');
    await expect(hwRow).toBeVisible();
    await expect(hwRow.locator('.ide-hw-map-row-pin')).toContainText(newPin);

    // Export — pin table should list SW0 with package pin (buildExportViewModel / pin table)
    await page.locator('[data-testid="mode-button-export"]').click();
    await expect(page.locator('[data-testid="ide-mode-export"]')).toBeVisible({ timeout: 15000 });
    const exportBody = page.locator('[data-testid="ide-export-panel"]');
    await expect(exportBody).toContainText(newPin, { timeout: 10000 });

    await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });
    const stablePath = path.join(ARTIFACT_DIR, 'ide-mapping-pipeline-coherence-flow-a-export.png');
    const shotPath = path.join(
      ARTIFACT_DIR,
      `ide-mapping-pipeline-flow-a-${testInfo.project.name}${Date.now()}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: true });
    await fs.promises.copyFile(shotPath, stablePath);
    await testInfo.attach('export-after-flow-a', { path: shotPath, contentType: 'image/png' });
  });

  test('Flow B: two-bit-counter — clock row visible on Hardware after Project mapping context', async ({
    page,
  }) => {
    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 60000 });
    await page.getByTestId('ide-project-landing-example-two-bit-counter').click();
    await expect(page.locator('[data-testid="ide-mode-design"]')).toBeVisible({ timeout: 30000 });

    await page.locator('[data-testid="mode-button-verify"]').click();
    await expect(page.locator('[data-testid="ide-mode-verify"]')).toBeVisible({ timeout: 15000 });
    const runBtn = page.getByTestId('ide-vcb-run');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
    }
    await page.waitForTimeout(800);

    await page.locator('[data-testid="mode-button-project"]').click();
    await expect(page.locator('[data-testid="ide-project-map-pins-header"]')).toBeVisible({
      timeout: 15000,
    });

    await page.locator('[data-testid="mode-button-hardware"]').click();
    await expect(page.locator('[data-testid="ide-mode-hardware"]')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ide-hw-mode-btn-map').click();
    await expect(page.locator('[data-testid="ide-hw-map-authority-callout"]')).toBeVisible();
    // CLK row exists in two-bit-counter mapping
    await expect(page.locator('[data-testid="ide-hw-map-row-clk"]')).toBeVisible({ timeout: 10000 });
  });
});
