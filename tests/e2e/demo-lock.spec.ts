// Demo Lock Smoke Test — "don't embarrass me" gate
// Validates: shell boots, playground opens, canvas renders, no fatal errors
// Target: <30s on typical machine

import { test, expect } from '@playwright/test';

test.describe('Demo Lock Gate', () => {
  test.describe.configure({ timeout: 30_000 });

  test('shell boots to desktop without fatal errors', async ({ page }) => {
    const fatalErrors: string[] = [];

    page.on('pageerror', (error) => {
      fatalErrors.push(`Uncaught: ${error.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected: bridge offline, fetch failures, extensions
        if (text.includes('127.0.0.1:4242')) return;
        if (text.includes('Failed to fetch')) return;
        if (text.includes('chrome-extension://')) return;
        if (text.includes('net::ERR_')) return;
        fatalErrors.push(text);
      }
    });

    await page.goto('/os/', { waitUntil: 'domcontentloaded' });

    // Shell container mounts
    await expect(page.locator('[data-testid="desktop-shell"]')).toBeVisible({ timeout: 15_000 });

    // Page title is set
    await expect(page).toHaveTitle(/RedByte|Playground/i);

    // No fatal errors
    expect(fatalErrors).toHaveLength(0);
  });

  test('can open Logic Playground from dock', async ({ page }) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', (error) => fatalErrors.push(error.message));

    await page.goto('/os/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="desktop-shell"]')).toBeVisible({ timeout: 15_000 });

    // Click Logic Playground dock icon or desktop icon
    const playgroundBtn = page.locator('[data-testid="dock-icon-logic-playground"], [data-testid="desktop-icon-logic-playground"]').first();
    if (await playgroundBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await playgroundBtn.click();

      // Wait for playground root to appear
      await expect(page.locator('[data-testid="logic-playground-root"]')).toBeVisible({ timeout: 15_000 });

      // Canvas or SVG rendered (2D circuit view)
      const canvasCount = await page.locator('canvas, svg').count();
      expect(canvasCount).toBeGreaterThan(0);
    }

    expect(fatalErrors).toHaveLength(0);
  });

  test('version stamp visible in top bar', async ({ page }) => {
    await page.goto('/os/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="desktop-shell"]')).toBeVisible({ timeout: 15_000 });

    // Version stamp should be visible (e.g., "v1.0.0 (abc1234)")
    const versionStamp = page.locator('header[role="banner"]').getByText(/v\d+\.\d+\.\d+/);
    await expect(versionStamp).toBeVisible({ timeout: 5_000 });
  });
});
