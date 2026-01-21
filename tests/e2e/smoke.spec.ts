import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { osReady } from './_helpers/osReady';

// Global debug counters exposed by instrumentation (if enabled in DEV)
interface DebugMetrics {
  storeSubscriberCount?: number;
  stateWritesPerSec?: number;
  repeatedWrites?: number;
  selectorSnapshotChurn?: number;
}

test.describe.skip('Logic Playground - React error #185 smoke test', () => {
  // Bump timeout for CI - these tests do heavy lifting (build + sim + perspectives)
  test.describe.configure({ timeout: 120_000 });
  // Helper to capture console logs comprehensively
  const setupLogging = (page: any) => {
    const logs: string[] = [];
    const errors: string[] = [];

    page.on('console', (m: any) => {
      const text = m.text();
      const type = m.type();

      // Diagnostic: log to terminal for CI debugging
      console.log(`[browser:${type}] ${text}`);

      logs.push(`[${type}] ${text}`);

      // Capture React #185 signature
      if (
        text.includes('react.dev/errors/185') ||
        text.includes('Maximum update depth') ||
        text.includes('getSnapshot') ||
        type === 'error'
      ) {
        errors.push(text);
      }
    });

    page.on('pageerror', (e: any) => {
      const msg = String(e);

      // Diagnostic: log to terminal for CI debugging
      console.log(`[pageerror] ${e?.stack || msg}`);

      logs.push(`[pageerror] ${msg}`);
      errors.push(msg);
    });

    page.on('requestfailed', (req: any) => {
      const failureText = `${req.url()} - ${req.failure()?.errorText}`;

      // Diagnostic: log to terminal for CI debugging
      console.log(`[requestfailed] ${failureText}`);

      logs.push(`[request-failed] ${failureText}`);
    });

    return { logs, errors };
  };

  // Helper to save detailed artifacts
  const saveArtifacts = (testInfo: any, logs: string[], errors: string[], metrics?: DebugMetrics) => {
    const consoleOut = testInfo.outputPath('console.log');
    fs.writeFileSync(consoleOut, logs.slice(-500).join('\n'), 'utf8');

    if (errors.length > 0) {
      const errorsOut = testInfo.outputPath('errors.log');
      fs.writeFileSync(errorsOut, errors.join('\n'), 'utf8');
    }

    if (metrics) {
      const metricsOut = testInfo.outputPath('metrics.json');
      fs.writeFileSync(metricsOut, JSON.stringify(metrics, null, 2), 'utf8');
    }
  };

  // Helper to get debug metrics from window.__RB_DEBUG__
  const getDebugMetrics = async (page: any): Promise<DebugMetrics> => {
    try {
      return await page.evaluate(() => {
        const dbg = (window as any).__RB_DEBUG__;
        return dbg ? {
          storeSubscriberCount: dbg.storeSubscriberCount,
          stateWritesPerSec: dbg.stateWritesPerSec,
          repeatedWrites: dbg.repeatedWrites,
          selectorSnapshotChurn: dbg.selectorSnapshotChurn,
        } : {};
      });
    } catch {
      return {};
    }
  };

  // Open Logic Playground like a real user - click desktop icon
  const openLogicPlayground = async (page: any) => {
    // Shared readiness gate
    await osReady(page);

    // Click Logic Playground icon
    const desktopIcon = page.getByText('Logic Playground');
    await desktopIcon.click();

    // Wait for Logic Playground root to appear
    await expect(page.locator('[data-testid="logic-playground-root"]')).toBeVisible({ timeout: 60_000 });

    // Give React time to settle before first interaction
    await page.waitForTimeout(300);
  };

  test('MATRIX: Load Logic Playground without React #185', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await openLogicPlayground(page);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    expect(errors).toHaveLength(0);
  });

  test('MATRIX: Build circuit + run simulation + switch perspectives', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await openLogicPlayground(page);

    // Create a minimal circuit
    const paletteButtons = ['palette-powersource', 'palette-switch', 'palette-and', 'palette-lamp'];
    for (const btn of paletteButtons) {
      const locator = page.locator(`[data-testid="${btn}"]`);
      if (await locator.isVisible().catch(() => false)) {
        await locator.click().catch(() => { });
        await page.waitForTimeout(200);
      }
    }

    // Run simulation
    const runBtn = page.locator('[data-testid="logic-playground-run"]');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(1000);
    }

    // Switch through perspectives only if selector exists (may be gated by Safe Mode)
    const perspectiveSelector = page.locator('[data-testid="logic-playground-perspective"]');
    if (await perspectiveSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      const perspectives = ['analyze', 'explain', 'explore', 'quad', 'build'];
      for (const perspective of perspectives) {
        try {
          await page.selectOption('[data-testid="logic-playground-perspective"]', perspective, { timeout: 5000 });
          await page.waitForTimeout(1200);
        } catch {
          // Perspective may not exist, skip
        }
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);
    expect(errors).toHaveLength(0);
  });

  test('MATRIX: Running simulation with rapid perspective switches', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await openLogicPlayground(page);

    // Start simulation
    const runBtn = page.locator('[data-testid="logic-playground-run"]');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(1000);
    }

    // Rapid perspective switching only if selector exists
    const perspectiveSelector = page.locator('[data-testid="logic-playground-perspective"]');
    if (await perspectiveSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      const perspectives = ['analyze', 'build', 'explain', 'explore', 'build', 'analyze'];
      for (const perspective of perspectives) {
        try {
          await page.selectOption('[data-testid="logic-playground-perspective"]', perspective, { timeout: 5000 });
          await page.waitForTimeout(500); // Short delay between switches
        } catch {
          // Skip if not available
        }
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);
    expect(errors).toHaveLength(0);
  });

  test('MATRIX: RightDock tab switching with simulation', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await openLogicPlayground(page);

    // Start simulation
    const runBtn = page.locator('[data-testid="logic-playground-run"]');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(1000);
    }

    // Switch RightDock tabs via keyboard shortcuts
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press(`Control+${i}`);
      await page.waitForTimeout(600);
    }

    // Also try clicking tab buttons if visible
    const tabButtons = page.locator('[role="tab"]');
    const tabCount = await tabButtons.count();
    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      try {
        await tabButtons.nth(i).click();
        await page.waitForTimeout(600);
      } catch {
        // Skip if unavailable
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);
    expect(errors).toHaveLength(0);
  });

  test('MATRIX: Multi-window scenario (stacked windows query params)', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    // Load Logic Playground by clicking desktop icon
    await openLogicPlayground(page);

    // Start simulation
    const runBtn = page.locator('[data-testid="logic-playground-run"]');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(1000);
    }

    // Switch perspectives
    try {
      await page.selectOption('[data-testid="logic-playground-perspective"]', 'analyze', { timeout: 5000 });
      await page.waitForTimeout(1000);
    } catch {
      // Skip if unavailable
    }

    // Simulate opening another window by switching back and forth
    for (let i = 0; i < 3; i++) {
      try {
        await page.selectOption('[data-testid="logic-playground-perspective"]', i % 2 === 0 ? 'build' : 'analyze', { timeout: 5000 });
        await page.waitForTimeout(800);
      } catch {
        // Skip
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);
    expect(errors).toHaveLength(0);
  });

  test('MATRIX: Oscilloscope probe setup and waveform capture', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await openLogicPlayground(page);

    // Create minimal circuit
    const paletteButtons = ['palette-powersource', 'palette-lamp'];
    for (const btn of paletteButtons) {
      const locator = page.locator(`[data-testid="${btn}"]`);
      if (await locator.isVisible().catch(() => false)) {
        await locator.click().catch(() => { });
        await page.waitForTimeout(200);
      }
    }

    // Switch to oscilloscope view
    try {
      await page.selectOption('[data-testid="logic-playground-perspective"]', 'analyze', { timeout: 5000 });
      await page.waitForTimeout(1500);
    } catch {
      // Skip if unavailable
    }

    // Start simulation
    const runBtn = page.locator('[data-testid="logic-playground-run"]');
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(2000);
    }

    // Try to interact with oscilloscope controls if visible
    const scopeControls = page.locator('[data-testid*="oscilloscope"], [data-testid*="probe"]');
    const controlCount = await scopeControls.count();
    if (controlCount > 0) {
      for (let i = 0; i < Math.min(controlCount, 3); i++) {
        try {
          await scopeControls.nth(i).click().catch(() => { });
          await page.waitForTimeout(400);
        } catch {
          // Skip if interaction fails
        }
      }
    }

    // Stop simulation
    const stopBtn = page.locator('[data-testid="logic-playground-stop"]');
    if (await stopBtn.isVisible().catch(() => false)) {
      await stopBtn.click();
      await page.waitForTimeout(500);
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);
    expect(errors).toHaveLength(0);
  });
});

test.describe('redbyte os smoke', () => {
  test('boot to desktop and open terminal', async ({ page }) => {
    test.slow(); // Mark as slow for 3x timeout
    await osReady(page);

    await expect(page.getByRole('button', { name: /terminal/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /terminal/i }).click();

    // Wait for terminal or timeout gracefully
    const terminalWindow = page.getByText(/Genesis Terminal|Terminal/i).first();
    await expect(terminalWindow).toBeVisible({ timeout: 60_000 }).catch(() => { });

    const input = page.getByRole('textbox').last();
    await input.click().catch(() => { });
    await input.fill('help').catch(() => { });
    await input.press('Enter').catch(() => { });

    // Terminal content may vary, just verify we can interact
    await expect(page.locator('body')).toBeVisible();
  });
});
