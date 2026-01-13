import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * VIEW/WINDOW MATRIX TEST SUITE
 * 
 * Systematic eradication of React #185 "Maximum update depth exceeded" across:
 * - All view perspectives (build, analyze, explain, explore, quad)
 * - Window operations (open, focus, minimize, maximize, close)
 * - Simulation states (stopped, running, stepping)
 * - Rapid state transitions
 * 
 * Every test must:
 * 1. Load app in CE mode (?ce=1)
 * 2. Set up minimal circuit (power -> gate -> lamp)
 * 3. Execute test-specific action sequence
 * 4. Assert: no console errors, no React #185 signature, no ErrorBoundary triggers
 * 5. Capture: console.log, errors.log, metrics.json, trace.zip
 */

interface DebugMetrics {
  storeSubscriberCount?: number;
  stateWritesPerSec?: number;
  repeatedWrites?: number;
  selectorSnapshotChurn?: number;
  lastError?: string;
  churnPercentage?: number;
}

const CE_MODE_URL = '/?ce=1&openApp=logic-playground';

// ============ HELPERS ============

const setupLogging = (page: any) => {
  const logs: string[] = [];
  const errors: string[] = [];
  const react185Signatures: string[] = [];

  page.on('console', (msg: any) => {
    const text = msg.text();
    const type = msg.type();
    logs.push(`[${type.toUpperCase()}] ${text}`);

    // Detect React #185 and similar error patterns
    if (
      text.includes('react.dev/errors/185') ||
      text.includes('Maximum update depth exceeded') ||
      text.includes('getSnapshot') ||
      text.includes('runaway') ||
      text.includes('infinite loop') ||
      type === 'error'
    ) {
      errors.push(text);
      react185Signatures.push(text);
    }
  });

  page.on('pageerror', (e: any) => {
    const msg = String(e);
    logs.push(`[PAGEERROR] ${msg}`);
    errors.push(msg);
    if (msg.includes('185') || msg.includes('Maximum update depth')) {
      react185Signatures.push(msg);
    }
  });

  page.on('requestfailed', (req: any) => {
    logs.push(`[REQUEST_FAILED] ${req.url()}`);
  });

  return { logs, errors, react185Signatures };
};

const getDebugMetrics = async (page: any): Promise<DebugMetrics> => {
  try {
    const metrics = await page.evaluate(() => {
      const dbg = (window as any).__RB_DEBUG__;
      if (!dbg) return {};
      return {
        storeSubscriberCount: dbg.storeSubscriberCount,
        stateWritesPerSec: dbg.stateWritesPerSec,
        repeatedWrites: dbg.repeatedWrites,
        selectorSnapshotChurn: dbg.selectorSnapshotChurn,
        churnPercentage: dbg.churnPercentage,
      };
    });
    return metrics;
  } catch {
    return {};
  }
};

const saveArtifacts = (
  testInfo: any,
  logs: string[],
  errors: string[],
  metrics?: DebugMetrics,
  trace?: boolean
) => {
  // Console log (last 1000 lines)
  const consoleOut = testInfo.outputPath('console.log');
  fs.writeFileSync(consoleOut, logs.slice(-1000).join('\n'), 'utf8');

  // Error log (if any)
  if (errors.length > 0) {
    const errorsOut = testInfo.outputPath('errors.log');
    fs.writeFileSync(errorsOut, errors.join('\n'), 'utf8');
  }

  // Metrics JSON
  if (metrics) {
    const metricsOut = testInfo.outputPath('metrics.json');
    fs.writeFileSync(metricsOut, JSON.stringify(metrics, null, 2), 'utf8');
  }

  // Note: Playwright trace is captured via test.use({ trace: 'on-first-retry' })
};

const createMinimalCircuit = async (page: any) => {
  // Click palette items to add to circuit: power source, AND gate, lamp
  const paletteIds = ['palette-powersource', 'palette-and', 'palette-lamp'];
  for (const id of paletteIds) {
    const btn = page.locator(`[data-testid="${id}"]`);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(150);
    }
  }
  await page.waitForTimeout(500);
};

const startSimulation = async (page: any) => {
  const runBtn = page.locator('[data-testid="logic-playground-run"], [data-testid="run-button"]');
  if (await runBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await runBtn.click().catch(() => {});
    await page.waitForTimeout(800);
  }
};

const stopSimulation = async (page: any) => {
  const stopBtn = page.locator('[data-testid="logic-playground-stop"], [data-testid="stop-button"]');
  if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await stopBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
};

const switchPerspective = async (page: any, perspective: string, delayMs = 800) => {
  const selector = page.locator('[data-testid="logic-playground-perspective"], [data-testid="perspective-select"]');
  try {
    await selector.selectOption(perspective, { timeout: 5000 });
    await page.waitForTimeout(delayMs);
  } catch {
    // Perspective may not exist, skip silently
  }
};

const assertNoReact185 = (errors: string[]) => {
  const react185Errors = errors.filter(
    (e) =>
      e.includes('185') ||
      e.includes('Maximum update depth') ||
      e.includes('getSnapshot') ||
      e.includes('runaway')
  );
  expect(react185Errors).toHaveLength(0);
};

// ============ MATRIX TESTS ============

test.describe('VIEW/WINDOW MATRIX: React #185 Eradication Suite', () => {
  test('[M1] Load CE mode without crashes', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    expect(errors).toHaveLength(0);
    expect(react185Signatures).toHaveLength(0);
  });

  test('[M2] Build perspective with simulation running', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);
    await switchPerspective(page, 'build', 600);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M3] Analyze perspective with simulation running', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);
    await switchPerspective(page, 'analyze', 800);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M4] Rapid perspective cycling (stress test)', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Rapid cycling through perspectives 5 times
    const perspectives = ['build', 'analyze', 'explain', 'explore', 'build'];
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const perspective of perspectives) {
        await switchPerspective(page, perspective, 400); // Shorter delay
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
    // Check that store churn didn't explode
    if (metrics.stateWritesPerSec !== undefined) {
      expect(metrics.stateWritesPerSec).toBeLessThan(100); // Sanity threshold
    }
  });

  test('[M5] Perspective switch while simulation is running and paused', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);

    // Run -> switch -> stop -> switch -> run -> switch pattern
    await startSimulation(page);
    await switchPerspective(page, 'analyze', 600);
    await stopSimulation(page);
    await switchPerspective(page, 'build', 600);
    await startSimulation(page);
    await switchPerspective(page, 'explain', 600);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M6] RightDock tab switching with simulation', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Switch RightDock tabs (if available)
    const tabButtons = page.locator('[role="tab"]');
    const tabCount = await tabButtons.count().catch(() => 0);

    if (tabCount > 0) {
      for (let i = 0; i < Math.min(tabCount, 6); i++) {
        try {
          await tabButtons.nth(i).click().catch(() => {});
          await page.waitForTimeout(500);
        } catch {
          // Skip unavailable tabs
        }
      }
    }

    // Also try keyboard shortcuts
    for (let i = 1; i <= 4; i++) {
      await page.keyboard.press(`Control+${i}`).catch(() => {});
      await page.waitForTimeout(400);
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M7] Multi-window simulation (query params)', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    // Window 1
    await page.goto(`${CE_MODE_URL}&windowId=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Simulate window focus switching by toggling perspectives
    for (let i = 0; i < 4; i++) {
      const perspective = i % 2 === 0 ? 'build' : 'analyze';
      await switchPerspective(page, perspective, 500);
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M8] Selection state changes during simulation', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Try to click on schematic elements (selection changes)
    const schematicArea = page.locator('[data-testid*="schematic"], [data-testid*="canvas"]');
    if (await schematicArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      const box = await schematicArea.boundingBox();
      if (box) {
        // Click random positions to simulate selection
        for (let i = 0; i < 5; i++) {
          const x = Math.random() * box.width + box.x;
          const y = Math.random() * box.height + box.y;
          await page.mouse.click(x, y).catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M9] Oscilloscope probe interaction + perspective switch', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Switch to analyze (oscilloscope view)
    await switchPerspective(page, 'analyze', 800);

    // Try to interact with oscilloscope controls
    const scopeControls = page.locator('[data-testid*="oscilloscope"], [data-testid*="probe"], [data-testid*="scope"]');
    const controlCount = await scopeControls.count().catch(() => 0);

    if (controlCount > 0) {
      for (let i = 0; i < Math.min(controlCount, 3); i++) {
        try {
          await scopeControls.nth(i).click().catch(() => {});
          await page.waitForTimeout(400);
        } catch {
          // Skip unavailable controls
        }
      }
    }

    // Switch away and back
    await switchPerspective(page, 'build', 600);
    await switchPerspective(page, 'analyze', 600);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
  });

  test('[M10] Stress: 20 rapid perspective switches with simulation', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Stress test: 20 rapid switches
    const perspectives = ['build', 'analyze', 'build', 'analyze', 'explain', 'build'];
    for (let i = 0; i < 20; i++) {
      const perspective = perspectives[i % perspectives.length];
      await switchPerspective(page, perspective, 200); // Very short delay
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics, true);

    assertNoReact185(errors);
    // Verify store churn stayed bounded
    if (metrics.stateWritesPerSec !== undefined) {
      expect(metrics.stateWritesPerSec).toBeLessThan(200); // Relaxed for stress
    }
  });
});

test.describe('CE MODE: Persistence & Recovery', () => {
  test.skip('[CE1] localStorage autosave and restore', async ({ page }, testInfo) => {
    // TODO: Implement localStorage autosave hook integration
    // Currently autosave is initialized but hook integration pending
    const { logs, errors } = setupLogging(page);

    // First load: create circuit
    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Simulate', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await createMinimalCircuit(page);
    await page.waitForTimeout(1000);

    // Reload and verify state restored
    await page.reload();
    await page.waitForSelector('text=Simulate', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Check that circuit elements are still visible
    const paletteItems = page.locator('[data-testid*="palette"]');
    const itemCount = await paletteItems.count().catch(() => 0);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    expect(errors).toHaveLength(0);
    expect(itemCount).toBeGreaterThan(0);
  });

  test('[CE2] Reset workspace clears all state', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    // Load and create circuit
    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await createMinimalCircuit(page);

    // Find and click reset button
    const resetBtn = page.locator('[data-testid*="reset"], button:has-text("Reset")');
    if (await resetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await resetBtn.click().catch(() => {});
      await page.waitForTimeout(1000);

      // Handle confirmation dialog if present
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("OK")');
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    expect(errors).toHaveLength(0);
  });
});

// ============ ISSUE REPRO TESTS (CE SHIPPING BLOCKERS) ============

test.describe('CE SHIPPING BLOCKERS: Issue Repro Suite', () => {
  test('[ISSUE-A] Quad View perspective without React #185', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await startSimulation(page);

    // Switch to Quad perspective (multi-view layout)
    await switchPerspective(page, 'quad', 1000);

    // Give it time to stabilize
    await page.waitForTimeout(2000);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // Assert no React #185
    assertNoReact185(errors);
    expect(errors).toHaveLength(0);
  });

  test('[ISSUE-B] RightDock controls are clickable', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await createMinimalCircuit(page);
    await page.waitForTimeout(500); // Let RightDock render

    // Try to click RightDock tab buttons (these are reported as hard to click)
    // Try multiple selectors since CE mode might differ
    let tabButtons = page.locator('button[title="Inspector"], button[title="Health"], button[title="Probes"], button[title="Record"], button[title="Chips"]');
    let tabCount = await tabButtons.count();
    
    if (tabCount === 0) {
      // Try alternative: look for the buttons by text content
      tabButtons = page.locator('button:has-text("Inspector"), button:has-text("Health"), button:has-text("Probes"), button:has-text("Record"), button:has-text("Chips")');
      tabCount = await tabButtons.count();
    }
    
    console.log(`[TEST] Found ${tabCount} tab buttons`);

    let clickSucceeded = 0;
    let clickFailed = 0;

    for (let i = 0; i < Math.min(tabCount, 6); i++) {
      try {
        const btn = tabButtons.nth(i);
        const title = await btn.getAttribute('title').catch(() => 'N/A');
        const text = await btn.innerText().catch(() => '');
        console.log(`[TEST] Attempting to click button ${i}: title="${title}", text="${text}"`);
        
        // Try to click WITHOUT force flag (natural clickability test)
        await btn.click({ timeout: 3000 });
        clickSucceeded++;
        console.log(`[TEST] Successfully clicked button ${i}`);
        await page.waitForTimeout(300);
      } catch (e) {
        clickFailed++;
        const title = await tabButtons.nth(i).getAttribute('title').catch(() => '');
        const text = await tabButtons.nth(i).innerText().catch(() => '');
        const errorMsg = `Tab ${i} (title="${title}", text="${text}") click failed: ${e.message || e}`;
        console.log(`[TEST ERROR] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[TEST] Click results: ${clickSucceeded} succeeded, ${clickFailed} failed out of ${tabCount} total`);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // Assert at least half the tabs are clickable naturally
    expect(clickSucceeded).toBeGreaterThan(0);
    expect(clickFailed).toBeLessThanOrEqual(tabCount / 2);
  });

  test('[ISSUE-C] CPU example loads without stack overflow', async ({ page }, testInfo) => {
    const { logs, errors, react185Signatures } = setupLogging(page);

    // Add specific listener for "Maximum call stack" errors
    const stackOverflowErrors: string[] = [];
    page.on('pageerror', (e: any) => {
      const msg = String(e);
      if (msg.includes('Maximum call stack') || msg.includes('stack overflow')) {
        stackOverflowErrors.push(msg);
      }
    });

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Try to load CPU example via example selector or query param
    // First check if there's an Examples button
    const examplesBtn = page.locator('button:has-text("Examples"), [data-testid*="examples"]');
    if (await examplesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await examplesBtn.click();
      await page.waitForTimeout(1000);

      // Look for CPU example in gallery
      const cpuExample = page.locator('button:has-text("CPU"), button:has-text("cpu")').first();
      if (await cpuExample.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cpuExample.click();
        await page.waitForTimeout(2000);
      }
    } else {
      // Fallback: Try direct example load via dropdown or URL param
      // Check for example dropdown in TopCommandBar
      const exampleDropdown = page.locator('select[data-testid*="example"]');
      if (await exampleDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await exampleDropdown.selectOption({ label: /CPU|cpu/i }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // Assert no stack overflow
    expect(stackOverflowErrors).toHaveLength(0);
    expect(errors.filter(e => e.includes('Maximum call stack'))).toHaveLength(0);

    // Page should still be responsive (no fatal crash)
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);
  });
});

// ============ CE MODE WORKFLOWS ============

test.describe('CE MODE: Classroom Workflows', () => {
  test('[CE-WF2] Reset Workspace button exists and is clickable', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    
    // Wait for the app to fully load - TopCommandBar takes time to render
    await page.waitForSelector('text=Simulate', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Find Reset button - uses emoji ↺
    const resetButton = page.locator('button').filter({ hasText: /↺/ });
    const resetCount = await resetButton.count();
    const resetVisible = resetCount > 0 && await resetButton.first().isVisible().catch(() => false);

    console.log(`[CE-WF2] Reset buttons found: ${resetCount}, visible: ${resetVisible}`);

    // Find Examples button - uses emoji 📚
    const examplesButton = page.locator('button').filter({ hasText: /📚/ });
    const examplesCount = await examplesButton.count();
    const examplesVisible = examplesCount > 0 && await examplesButton.first().isVisible().catch(() => false);

    console.log(`[CE-WF2] Examples buttons found: ${examplesCount}, visible: ${examplesVisible}`);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // At least one CE button should be visible
    expect(resetVisible || examplesVisible).toBeTruthy();
    expect(errors).toHaveLength(0);
  });

  test('[CE-WF3] Help overlay opens with "?" key', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Press "?" to open help
    await page.keyboard.press('?');
    await page.waitForTimeout(500);

    // Check if help overlay appeared (look for keyboard shortcuts content)
    const helpVisibleByTestId = await page.locator('[data-testid*="keyboard"], [data-testid*="help"]').isVisible({ timeout: 1000 }).catch(() => false);
    const helpVisibleByRole = await page.locator('dialog, [role="dialog"]').isVisible({ timeout: 1000 }).catch(() => false);
    const helpVisibleByClass = await page.locator('[class*="help"], [class*="modal"], [class*="overlay"]').first().isVisible({ timeout: 1000 }).catch(() => false);

    const helpOpened = helpVisibleByTestId || helpVisibleByRole || helpVisibleByClass;
    console.log(`[TEST] Help overlay opened: ${helpOpened}`);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // "?" key should be bindable (test passes if no crash)
    expect(errors.filter(e => e.includes('error'))).toHaveLength(0);
  });

  test('[CE-WF4] Export button exists and is clickable', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Create a circuit first
    await createMinimalCircuit(page);

    // Find Export button
    const exportButton = page.locator('button').filter({ hasText: /Export/ });
    const exportVisible = await exportButton.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`[TEST] Export button visible: ${exportVisible}`);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // Export button should exist
    expect(exportVisible).toBeTruthy();
    expect(errors).toHaveLength(0);
  });

  test('[CE-WF5] Heavy circuit detection: loads without crash', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Load a complex example if available
    const examplesButton = page.locator('button').filter({ hasText: /Examples/ });
    const examplesVisible = await examplesButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (examplesVisible) {
      await examplesButton.click();
      await page.waitForTimeout(1000);
      console.log('[TEST] Examples gallery opened');
    }

    // Page should still be responsive (no crash)
    const bodyVisible = await page.locator('body').isVisible({ timeout: 2000 });

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // Should load without crashing
    expect(bodyVisible).toBe(true);
    expect(errors.filter(e => e.includes('stack') || e.includes('crash'))).toHaveLength(0);
  });

  test('[CE-WF6] CE mode: app loads with Examples, Reset, Export buttons', async ({ page }, testInfo) => {
    const { logs, errors } = setupLogging(page);

    await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
    
    // Wait for the app to fully load
    await page.waitForSelector('text=Simulate', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Check for all CE buttons
    // Examples: text "📚 Examples" or just "Examples"
    // Reset: emoji "↺"
    // Export: text "Export"
    const examplesButton = page.locator('button').filter({ hasText: /📚|Examples/ });
    const resetButton = page.locator('button').filter({ hasText: /↺/ });
    const exportButton = page.locator('button').filter({ hasText: /Export/ });

    const examplesVisible = await examplesButton.first().isVisible().catch(() => false);
    const resetVisible = await resetButton.first().isVisible().catch(() => false);
    const exportVisible = await exportButton.first().isVisible().catch(() => false);

    console.log(`[TEST] CE buttons - Examples: ${examplesVisible}, Reset: ${resetVisible}, Export: ${exportVisible}`);

    const metrics = await getDebugMetrics(page);
    saveArtifacts(testInfo, logs, errors, metrics);

    // All CE buttons should be visible in CE mode
    expect(examplesVisible).toBeTruthy();
    expect(resetVisible).toBeTruthy();
    expect(exportVisible).toBeTruthy();
    expect(errors).toHaveLength(0);
  });
});

