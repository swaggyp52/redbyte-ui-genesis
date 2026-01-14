import { test, expect } from "@playwright/test";

test.describe("Guard Verification", () => {
  test("Complexity guardrail blocks at 20 nodes", async ({ page }) => {
    // Navigate with domcontentloaded (no networkidle trap)
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });

    // Wait for DOM sentinel (real app root)
    await expect(page.locator("#root")).toBeVisible({ timeout: 5000 });

    // Wait for bridge to be ready (installed AND store loaded)
    await page.waitForFunction(() => (window as any).__RB_E2E__?.isReady?.() === true, { timeout: 15000 });

    // Single evaluate: reset, add nodes, verify guard
    const res = await page.evaluate(() => {
      const b = (window as any).__RB_E2E__;
      b.resetWorkspace();
      const beforeAdd = b.getNodeCount();
      b.addNodes(20);
      const after20 = b.getNodeCount();
      b.addNodes(1); // Should be blocked by guard
      const after21 = b.getNodeCount();
      return {
        beforeAdd,
        after20,
        after21,
        ready: b.isReady(),
      };
    });

    console.log("Results:", res);

    // Guard should prevent going beyond 20
    expect(res.after20).toBeLessThanOrEqual(20);
    expect(res.after21).toBe(res.after20); // Should not increment beyond hard limit
  });

  test("Load path clamps circuits exceeding 20 nodes", async ({ page }) => {
    // Navigate with domcontentloaded (no networkidle trap)
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });

    // Wait for DOM sentinel (real app root)
    await expect(page.locator("#root")).toBeVisible({ timeout: 5000 });

    // Wait for bridge to be ready (installed AND store loaded)
    await page.waitForFunction(() => (window as any).__RB_E2E__?.isReady?.() === true, { timeout: 15000 });

    // Single evaluate: create 25-node circuit, load it, verify clamped to 20
    const res = await page.evaluate(() => {
      const b = (window as any).__RB_E2E__;
      
      // Build a 25-node circuit
      const nodes = Array.from({ length: 25 }, (_, i) => ({
        id: `n${i}`,
        type: "NOT",
        position: { x: 50 + i * 10, y: 80 },
      }));
      const circuit = { nodes, connections: [] };

      // Load it via the test bridge (exercises updateCircuit with enforceLimits=true)
      b.loadCircuitForTest(circuit);

      return {
        nodeCount: b.getNodeCount(),
        ready: b.isReady(),
      };
    });

    console.log("Load test results:", res);

    // Should have been clamped to 20 (not 25)
    expect(res.nodeCount).toBe(20);
  });

  test("Undo into >20 nodes triggers auto-degrade", async ({ page }) => {
    // Navigate with domcontentloaded (no networkidle trap)
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });

    // Wait for DOM sentinel (real app root)
    await expect(page.locator("#root")).toBeVisible({ timeout: 5000 });

    // Wait for bridge to be ready (installed AND store loaded)
    await page.waitForFunction(() => (window as any).__RB_E2E__?.isReady?.() === true, { timeout: 15000 });

    // Single evaluate: add 15 nodes (legal), then use loadCircuitForTest to simulate undo into 25-node state
    const res = await page.evaluate(() => {
      const b = (window as any).__RB_E2E__;
      
      // Start clean
      b.resetWorkspace();
      
      // Add 15 nodes normally (under limit)
      b.addNodes(15);
      const before = b.getNodeCount();
      
      // Simulate "undo into old state" by loading a 25-node circuit with enforceLimits=false
      // (this mimics undo/redo which bypasses limits to stay lossless)
      const nodes = Array.from({ length: 25 }, (_, i) => ({
        id: `old${i}`,
        type: "NOT",
        position: { x: 50 + i * 10, y: 80 },
      }));
      const oldCircuit = { nodes, connections: [] };
      
      // Access store directly to simulate undo (which uses enforceLimits: false)
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (store) {
        store.getState().updateCircuit(oldCircuit, { skipHistory: true, enforceLimits: false });
      }
      
      const after = b.getNodeCount();
      
      // Check classroom mode store for auto-degrade
      const cmStore = (window as any).__RB_CLASSROOM_MODE_STORE__;
      const safeMode = cmStore?.getState().safeMode;
      const stepOnly = cmStore?.getState().isStepOnlyMode;
      
      return {
        before,
        after,
        safeMode,
        stepOnly,
        ready: b.isReady(),
      };
    });

    console.log("Undo into >20 results:", res);

    // Should have 25 nodes (enforceLimits was false)
    expect(res.after).toBe(25);
    
    // Auto-degrade should have triggered
    expect(res.safeMode).toBe(true);
    expect(res.stepOnly).toBe(true);
    
    // Wait for React to render the banner (give React time to update)
    await page.waitForTimeout(500);
    
    // Banner should be visible
    await expect(page.locator('[data-testid="auto-degrade-banner"]')).toBeVisible({ timeout: 5000 });
  });

  test("Clamp event shows banner with details", async ({ page }) => {
    // Navigate with domcontentloaded (no networkidle trap)
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });

    // Wait for DOM sentinel (real app root)
    await expect(page.locator("#root")).toBeVisible({ timeout: 5000 });

    // Wait for bridge to be ready (installed AND store loaded)
    await page.waitForFunction(() => (window as any).__RB_E2E__?.isReady?.() === true, { timeout: 15000 });

    // Load 25-node circuit (will be clamped)
    await page.evaluate(() => {
      const b = (window as any).__RB_E2E__;
      
      const nodes = Array.from({ length: 25 }, (_, i) => ({
        id: `n${i}`,
        type: "NOT",
        position: { x: 50 + i * 10, y: 80 },
      }));
      const circuit = { nodes, connections: [] };

      b.loadCircuitForTest(circuit);
    });

    // Wait for React to render the banner
    await page.waitForTimeout(500);

    // Clamp banner should appear
    await expect(page.locator('[data-testid="clamp-banner"]')).toBeVisible({ timeout: 5000 });
    
    // Should show correct counts
    await expect(page.locator('[data-testid="clamp-banner"]')).toContainText('Loaded 20 of 25 nodes');
  });
});
