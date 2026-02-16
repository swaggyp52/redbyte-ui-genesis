// Screenshot automation: before/after evidence for UI sprint
// Usage: pnpm ui:screenshots

import { test,expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { osReady } from './_helpers/osReady';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/after');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('UI Screenshots for Classroom Evidence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage before each test to get clean state
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('captures desktop after boot', async ({ page }) => {
    // Full boot to desktop
    await osReady(page);

    // Wait a moment for animations to settle
    await page.waitForTimeout(500);

    // Capture desktop
    const desktop = page.locator('[data-testid="shell-desktop"]');
    await expect(desktop).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop.png'), fullPage: true });
    console.log('✓ Captured: desktop.png');
  });

  test('captures export UI from lab workspace', async ({ page }) => {
    await osReady(page);

    // Navigate directly to lab workspace in freeplay mode
    await page.goto('/os/?app=lab-workspace&labId=freeplay');
    
    // Wait for lab workspace to load
    await expect(page.locator('[data-testid="lab-workspace-root"]')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1000);

    // Click the submit/export tab
    const submitTab = page.locator('[data-testid="lab-workspace-tab-submit"]');
    await expect(submitTab).toBeVisible({ timeout: 10000 });
    await submitTab.click();
    await page.waitForTimeout(500);

    // Capture the entire lab workspace showing export panel
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'export-panel.png'), fullPage: true });
    console.log('✓ Captured: export-panel.png');
  });
});
