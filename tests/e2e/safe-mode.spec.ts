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
});
