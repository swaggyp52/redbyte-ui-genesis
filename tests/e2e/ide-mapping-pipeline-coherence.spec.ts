/**
 * Real localhost runtime proof: Verify → Project (Map Pins) → Hardware → Export
 * share one mapping truth. Uses preview server (playwright webServer on 4173).
 */
import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts');

test.describe('IDE mapping pipeline coherence (student journey)', () => {
  test('Flow A: signal-tour — Project mirrors mapping, Map Pins assigns it, Export reflects it', async ({
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

    // Project — mapping truth is visible here, but Map Pins remains the editing authority.
    await page.locator('[data-testid="mode-button-project"]').click();
    await expect(page.locator('[data-testid="ide-mode-project"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="ide-project-map-pins-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="ide-project-open-map-pins"]')).toBeVisible();
    await expect(page.locator('[data-testid="ide-project-map-input-sw0"]')).toHaveCount(0);

    // Hardware / Map Pins — select the signal row, then click a board region to assign it.
    await page.locator('[data-testid="mode-button-hardware"]').click();
    await expect(page.locator('[data-testid="ide-mode-hardware"]')).toBeVisible({ timeout: 15000 });
    const mapModeButton = page.getByTestId('ide-hw-mode-btn-map');
    if (await mapModeButton.isVisible().catch(() => false)) {
      await mapModeButton.click();
    }
    await expect(page.locator('[data-testid="ide-hw-map-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="ide-hw-board-workspace"]')).toBeVisible();
    const hwRow = page.locator('[data-testid="ide-hw-map-row-sw0"]');
    await expect(hwRow).toBeVisible();
    await hwRow.click();
    await page.getByTestId('ide-hw-map-sw-4').click({ force: true });
    await expect(page.locator('[data-testid="ide-hw-map-row-binding-sw0"]')).toContainText('SW4');
    await expect(page.locator('[data-testid="ide-hw-map-row-binding-sw0"]')).toContainText('W15');

    // Project — same mapping truth mirrors back here without exposing an editor.
    await page.locator('[data-testid="mode-button-project"]').click();
    await expect(page.locator('[data-testid="ide-mode-project"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="ide-project-pin-field-sw0"]')).toContainText('SW4 (pin W15)');

    // Export — pin table should list SW0 with package pin (buildExportViewModel / pin table)
    await page.locator('[data-testid="mode-button-export"]').click();
    await expect(page.locator('[data-testid="ide-mode-export"]')).toBeVisible({ timeout: 15000 });
    const exportBody = page.locator('[data-testid="ide-export-panel"]');
    await expect(exportBody).toContainText('SW4 (pin W15)', { timeout: 10000 });

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
    await expect(page.locator('[data-testid="ide-project-open-map-pins"]')).toBeVisible();
    await expect(page.locator('[data-testid="ide-project-map-input-clk"]')).toHaveCount(0);

    await page.locator('[data-testid="mode-button-hardware"]').click();
    await expect(page.locator('[data-testid="ide-mode-hardware"]')).toBeVisible({ timeout: 15000 });
    const mapModeButton = page.getByTestId('ide-hw-mode-btn-map');
    if (await mapModeButton.isVisible().catch(() => false)) {
      await mapModeButton.click();
    }
    await expect(page.locator('[data-testid="ide-hw-map-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="ide-hw-board-workspace"]')).toBeVisible();
    // CLK row exists in two-bit-counter mapping
    await expect(page.locator('[data-testid="ide-hw-map-row-clk"]')).toBeVisible({ timeout: 10000 });
  });
});
