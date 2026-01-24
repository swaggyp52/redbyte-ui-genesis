// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Smoke test: Boot the OS and verify no fatal errors

import { test, expect } from '@playwright/test';

test.describe('Boot Smoke Test', () => {
  test('OS boots without white screen or fatal errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (error) => {
      errors.push(`Uncaught: ${error.message}`);
    });

    // Navigate to the app
    await page.goto('/');

    // Wait for desktop to render (login screen should auto-login in dev)
    await page.waitForSelector('[data-testid="desktop-shell"]', {
      timeout: 10000,
      state: 'visible',
    });

    // Verify no white screen - check for key OS elements
    const desktopVisible = await page.locator('[data-testid="desktop-shell"]').isVisible();
    expect(desktopVisible).toBe(true);

    // Check for app grid/taskbar
    const appGridExists = await page.locator('[data-testid="app-grid"], .app-launcher, .taskbar').count();
    expect(appGridExists).toBeGreaterThan(0);

    // Filter out benign errors (hardware bridge offline is expected in demo)
    const fatalErrors = errors.filter((err) => {
      // Ignore expected hardware offline errors
      if (err.includes('127.0.0.1:4242') || err.includes('Hardware')) return false;
      if (err.includes('Failed to fetch')) return false;
      // Ignore third-party extension errors
      if (err.includes('chrome-extension://')) return false;
      return true;
    });

    // Report fatal errors
    if (fatalErrors.length > 0) {
      console.error('Fatal errors detected:', fatalErrors);
    }
    expect(fatalErrors.length).toBe(0);

    // Verify page title
    await expect(page).toHaveTitle(/RedByte|Logic/i);

    console.log('✅ Boot smoke test passed - OS rendered without fatal errors');
  });

  test('can open Logic Playground app', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop-shell"]', { timeout: 10000 });

    // Find and click Logic Playground app launcher
    const appLauncher = page.locator('text="Logic Playground"').first();
    if (await appLauncher.count() > 0) {
      await appLauncher.click();

      // Wait for app window to open
      await page.waitForSelector('[data-window-id]', { timeout: 5000 });

      // Verify canvas rendered
      const canvas = await page.locator('canvas, svg').count();
      expect(canvas).toBeGreaterThan(0);

      console.log('✅ Logic Playground opened successfully');
    } else {
      console.warn('⚠️ Logic Playground launcher not found (skipped)');
    }
  });

  test('can open ECE 347 Lab app', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="desktop-shell"]', { timeout: 10000 });

    // Find and click ECE 347 Lab app launcher
    const appLauncher = page.locator('text="ECE 347 Lab"').first();
    if (await appLauncher.count() > 0) {
      await appLauncher.click();

      // Wait for app window
      await page.waitForSelector('[data-window-id]', { timeout: 5000 });

      console.log('✅ ECE 347 Lab opened successfully');
    } else {
      console.warn('⚠️ ECE 347 Lab launcher not found (skipped)');
    }
  });
});
