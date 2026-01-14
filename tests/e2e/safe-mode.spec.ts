import { test, expect } from "@playwright/test";

test.describe("Guard Verification", () => {
  test("Complexity guardrail blocks at 20 nodes", async ({ page }) => {
    // Navigate with domcontentloaded (no networkidle trap)
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });

    // Wait for DOM sentinel (real app root)
    await expect(page.locator("#root")).toBeVisible({ timeout: 5000 });

    // Wait for bridge to be ready (installed AND store loaded)
    await page.waitForFunction(async () => {
      const b = (window as any).__RB_E2E__;
      if (!b || typeof b.isReady !== "function") return false;
      return await b.isReady();
    }, { timeout: 15000 });

    // Single evaluate: reset, add nodes, verify guard
    const res = await page.evaluate(async () => {
      const b = (window as any).__RB_E2E__;
      await b.resetWorkspace();
      const beforeAdd = await b.getNodeCount();
      await b.addNodes(20);
      const after20 = await b.getNodeCount();
      await b.addNodes(1); // Should be blocked by guard
      const after21 = await b.getNodeCount();
      return {
        beforeAdd,
        after20,
        after21,
        ready: await b.isReady(),
      };
    });

    console.log("Results:", res);

    // Guard should prevent going beyond 20
    expect(res.after20).toBeLessThanOrEqual(20);
    expect(res.after21).toBe(res.after20); // Should not increment beyond hard limit
  });
});
