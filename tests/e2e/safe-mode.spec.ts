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

test.describe('Reset + Recovery - Classroom Readiness', () => {
  test('Reset Workspace clears circuit and snapshots', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Simulate circuit data in localStorage
    await page.evaluate(() => {
      localStorage.setItem('rb_circuit', JSON.stringify({ nodes: [{id: 'test-node'}], connections: [] }));
      localStorage.setItem('rb_workspace_latest', JSON.stringify({
        schemaVersion: 1,
        timestamp: Date.now(),
        reason: 'autosave',
        payload: { circuit: {}, layout: {}, flags: { safeMode: false } }
      }));
    });

    // Open Reset menu
    const resetButton = page.getByTestId('reset-menu-button');
    await expect(resetButton).toBeVisible({ timeout: 5000 });
    await resetButton.click();

    // Click Reset Workspace
    const resetWorkspaceButton = page.getByTestId('reset-workspace-button');
    await expect(resetWorkspaceButton).toBeVisible();
    
    // Mock confirm dialog
    page.on('dialog', dialog => dialog.accept());
    
    await resetWorkspaceButton.click();
    
    // Page should reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify circuit cleared from localStorage
    const circuit = await page.evaluate(() => localStorage.getItem('rb_circuit'));
    expect(circuit).toBeNull();
  });

  test('Recovery banner appears after abnormal shutdown', async ({ page }) => {
    // Set up synthetic crash state
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      // Create snapshot
      localStorage.setItem('rb_workspace_latest', JSON.stringify({
        schemaVersion: 1,
        timestamp: Date.now(),
        reason: 'autosave',
        payload: { 
          circuit: { nodes: [{id: 'recovered-node', type: 'INPUT'}], connections: [] }, 
          layout: {}, 
          flags: { safeMode: false } 
        }
      }));
      
      // Mark abnormal shutdown
      localStorage.setItem('rb_last_clean_shutdown', 'false');
    });

    // Reload to trigger recovery detection
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Recovery banner should be visible
    const recoveryBanner = page.getByTestId('recovery-banner');
    await expect(recoveryBanner).toBeVisible({ timeout: 5000 });

    // Click Recover
    const recoverButton = page.getByTestId('recovery-recover-button');
    await expect(recoverButton).toBeVisible();
    await recoverButton.click();

    // Banner should disappear
    await expect(recoveryBanner).not.toBeVisible({ timeout: 3000 });
  });

  test('Recovery banner Details button shows snapshot info', async ({ page }) => {
    // Set up crash state with snapshot
    await page.goto('http://localhost:5173');
    const testTimestamp = Date.now();
    await page.evaluate((ts) => {
      localStorage.setItem('rb_workspace_latest', JSON.stringify({
        schemaVersion: 1,
        timestamp: ts,
        reason: 'autosave',
        payload: { circuit: {}, layout: {}, flags: { safeMode: true } }
      }));
      localStorage.setItem('rb_last_clean_shutdown', 'false');
    }, testTimestamp);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click Details
    const detailsButton = page.getByTestId('recovery-details-button');
    await expect(detailsButton).toBeVisible({ timeout: 5000 });
    await detailsButton.click();

    // Verify details shown
    await expect(page.locator('text=Schema: v1')).toBeVisible();
    await expect(page.locator('text=Reason: autosave')).toBeVisible();
    await expect(page.locator('text=Safe Mode: Yes')).toBeVisible();
  });
});

test.describe('Complexity Guardrails - Classroom Readiness', () => {
  test('Complexity warning banner appears at 15+ nodes', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Set complexity via store
    await page.evaluate(() => {
      if ((window as any).useClassroomModeStore) {
        const store = (window as any).useClassroomModeStore.getState();
        if (store && store.setComplexity) {
          store.setComplexity(15, 20, 3);
        }
      }
    });

    await page.waitForTimeout(500);

    // Warning banner should appear
    const warningBanner = page.getByTestId('complexity-warning-banner');
    await expect(warningBanner).toBeVisible({ timeout: 3000 });
    await expect(warningBanner).toContainText('Circuit is getting complex');
  });

  test('Complexity blocking at 20 nodes shows blocked banner', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Set complexity to blocking threshold
    await page.evaluate(() => {
      if ((window as any).useClassroomModeStore) {
        const store = (window as any).useClassroomModeStore.getState();
        if (store && store.setComplexity) {
          store.setComplexity(20, 40, 3);
        }
      }
    });

    await page.waitForTimeout(300);

    // Blocked banner should appear
    const blockedBanner = page.getByTestId('complexity-blocked-banner');
    await expect(blockedBanner).toBeVisible({ timeout: 5000 });
    await expect(blockedBanner).toContainText('Circuit limit reached (20 nodes)');
    await expect(blockedBanner).toContainText('Simplify your circuit or reset workspace');
  });
});
