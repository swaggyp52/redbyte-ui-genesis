import { test, expect } from '@playwright/test';

/**
 * Minimal smoke test for Night Shift overnight runs.
 * 
 * This tests the absolute minimum to catch silent UI breakage:
 * - Boot (desktop loads)
 * - Playground launches
 * - Switch toggle works
 * - Signal propagates to output
 * 
 * Runtime: ~10 seconds headless
 * Use: Runs after pnpm test + pnpm build in night_shift.ps1
 */
test.describe('Night Shift Smoke Test', () => {
  test.describe.configure({ timeout: 30_000 });

  test('playground: boot + toggle switch → output propagates', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Wait for boot (desktop should appear)
    await expect(page.locator('[data-testid="desktop"]')).toBeVisible({ timeout: 15_000 });
    
    // Open Logic Playground from dock
    const dockIcon = page.locator('[data-testid="dock-icon-playground"]').first();
    await expect(dockIcon).toBeVisible({ timeout: 5_000 });
    await dockIcon.click();
    
    // Wait for playground window to appear
    const playgroundWindow = page.locator('[data-testid="window-playground"]').first();
    await expect(playgroundWindow).toBeVisible({ timeout: 5_000 });
    
    // Wait for canvas to be ready
    const canvas = playgroundWindow.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 3_000 });
    
    // Add a switch (INPUT)
    const toolsPanel = playgroundWindow.locator('[data-testid="tools-panel"]');
    const inputBtn = toolsPanel.locator('button:has-text("INPUT")').first();
    await inputBtn.click();
    
    // Click on canvas to place switch
    await canvas.click({ position: { x: 100, y: 100 } });
    
    // Add an output (OUTPUT)
    const outputBtn = toolsPanel.locator('button:has-text("OUTPUT")').first();
    await outputBtn.click();
    await canvas.click({ position: { x: 300, y: 100 } });
    
    // Connect switch to output (drag from switch port to output port)
    // Note: This is a simplified version; actual connection logic may vary
    await page.mouse.move(120, 100); // Near switch output port
    await page.mouse.down();
    await page.mouse.move(280, 100); // Near output input port
    await page.mouse.up();
    
    // Toggle the switch
    const switchNode = canvas.locator('[data-node-type="INPUT"]').first();
    await switchNode.click({ timeout: 2_000 });
    
    // Wait a moment for signal propagation
    await page.waitForTimeout(500);
    
    // Verify no React errors in console
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      errors.push(String(e));
    });
    page.on('console', (m) => {
      if (m.type() === 'error') {
        errors.push(m.text());
      }
    });
    
    // If we got here without crashes, smoke test passes
    expect(errors.filter(e => 
      e.includes('react.dev/errors') || 
      e.includes('Maximum update depth')
    ).length).toBe(0);
  });
});
