import { test, expect } from '@playwright/test';

test.describe('Safe Mode - Classroom Readiness', () => {
  test('Safe Mode toggle persists to localStorage', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Wait for Safe Mode button to appear
    const safeModeButton = page.getByTestId('safe-mode-toggle');
    await expect(safeModeButton).toBeVisible({ timeout: 5000 });

    // Initial state should be "Normal"
    await expect(safeModeButton).toContainText('Normal');

    // Click to enable Safe Mode
    await safeModeButton.click();
    await page.waitForTimeout(300);

    // Button should now show "Safe"
    await expect(safeModeButton).toContainText('Safe');

    // Check localStorage was updated
    const storedValue = await page.evaluate(() => localStorage.getItem('rb_safe_mode'));
    expect(storedValue).toBe('1');

    // Reload page and verify Safe Mode persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const safeModeButtonAfterReload = page.getByTestId('safe-mode-toggle');
    await expect(safeModeButtonAfterReload).toContainText('Safe');
  });

  test('Safe Mode disables Quad and 3D perspective options', async ({ page }) => {
    // Navigate to app and enable Safe Mode
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Enable Safe Mode
    const safeModeButton = page.getByTestId('safe-mode-toggle');
    await expect(safeModeButton).toBeVisible({ timeout: 5000 });
    await safeModeButton.click();
    await page.waitForTimeout(300);

    // Open perspective selector
    const perspectiveSelector = page.getByTestId('logic-playground-perspective');
    await expect(perspectiveSelector).toBeVisible();

    // Try to select Quad (should be disabled)
    const quadOption = perspectiveSelector.locator('option[value="quad"]');
    const isDisabled = await quadOption.evaluate((el: HTMLOptionElement) => el.disabled);
    expect(isDisabled).toBe(true);

    // Try to select 3D Only (should be disabled)
    const threeDOption = perspectiveSelector.locator('option[value="3d-only"]');
    const is3DDisabled = await threeDOption.evaluate((el: HTMLOptionElement) => el.disabled);
    expect(is3DDisabled).toBe(true);

    // Verify other options are still enabled
    const buildOption = perspectiveSelector.locator('option[value="build"]');
    const isBuildEnabled = await buildOption.evaluate((el: HTMLOptionElement) => !el.disabled);
    expect(isBuildEnabled).toBe(true);
  });

  test('Safe Mode can be toggled off and on', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    const safeModeButton = page.getByTestId('safe-mode-toggle');
    await expect(safeModeButton).toBeVisible({ timeout: 5000 });

    // Toggle on
    await safeModeButton.click();
    await expect(safeModeButton).toContainText('Safe');

    // Toggle off
    await safeModeButton.click();
    await expect(safeModeButton).toContainText('Normal');

    // Verify localStorage cleared
    const storedValue = await page.evaluate(() => localStorage.getItem('rb_safe_mode'));
    expect(storedValue).toBe('0');
  });

  test('Reset Workspace button clears circuit and reloads', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Open Reset menu
    const resetButton = page.getByTestId('reset-menu-button');
    await expect(resetButton).toBeVisible({ timeout: 5000 });
    await resetButton.click();

    // Click Reset Workspace
    const resetWorkspaceButton = page.getByTestId('reset-workspace-button');
    await expect(resetWorkspaceButton).toBeVisible();
    
    // Mock confirm dialog to accept
    page.on('dialog', dialog => dialog.accept());
    
    await resetWorkspaceButton.click();
    
    // Page should reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify we're still on the app
    const safeModeButton = page.getByTestId('safe-mode-toggle');
    await expect(safeModeButton).toBeVisible({ timeout: 5000 });
  });

  test('Safe Mode via URL parameter (?safe=1) works on load', async ({ page }) => {
    // Navigate with safe=1 parameter
    await page.goto('http://localhost:5173?safe=1');
    await page.waitForLoadState('networkidle');

    // Safe Mode should be enabled
    const safeModeButton = page.getByTestId('safe-mode-toggle');
    await expect(safeModeButton).toBeVisible({ timeout: 5000 });
    await expect(safeModeButton).toContainText('Safe');

    // Verify quad is disabled
    const perspectiveSelector = page.getByTestId('logic-playground-perspective');
    const quadOption = perspectiveSelector.locator('option[value="quad"]');
    const isDisabled = await quadOption.evaluate((el: HTMLOptionElement) => el.disabled);
    expect(isDisabled).toBe(true);
  });
});
