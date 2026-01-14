import { test, expect, Page } from "@playwright/test";

test.describe("Guard Verification", () => {
  test("Complexity guardrail blocks at 20 nodes", async ({ page }) => {
    const messages: string[] = [];
    let errorFound = false;

    page.on("console", (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      messages.push(text);
      if (msg.type() === "error") {
        errorFound = true;
        console.log("ERROR FOUND:", msg.text());
      }
    });

    page.on("pageerror", (err) => {
      errorFound = true;
      console.log("PAGE ERROR:", err.toString());
      messages.push(`[PAGE_CRASH] ${err.toString()}`);
    });

    console.log("Navigating to /?e2e=1");
    await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });
    console.log("Waiting for bridge");
    await page.waitForFunction(() => !!(window as any).__RB_E2E__, { timeout: 5000 });
    console.log("Bridge ready");
    
    // Check for heartbeat messages
    console.log("=== CHECKING HEARTBEATS ===");
    messages.slice(-20).forEach((m) => {
      if (m.includes("HEARTBEAT")) console.log(m);
    });
    console.log("=== END HEARTBEATS ===");
    
    await page.waitForTimeout(250);

    console.log("=== PAGE MESSAGES ===");
    messages.slice(-10).forEach((m) => console.log(m));
    console.log("=== END ===");
    console.log("Error found:", errorFound);

    // Use the bridge to add 20 nodes and verify guard blocks
    console.log("Calling addNodes(20) via bridge");
    
    // Try a simple evaluate first
    try {
      const bridgeExists = await page.evaluate(() => !!(window as any).__RB_E2E__, { timeout: 2000 });
      console.log("Bridge exists per evaluate:", bridgeExists);
    } catch (e) {
      console.log("Bridge check evaluate failed:", (e as Error).message);
    }
    
    // Try calling addNodes
    try {
      const nodeCount = await page.evaluate(
        async () => {
          const e2e = (window as any).__RB_E2E__;
          if (!e2e) throw new Error("Bridge not found");
          const count = await e2e.addNodes(20);
          return count;
        },
        { timeout: 5000 }
      );
      console.log("Node count after addNodes(20):", nodeCount);
      expect(nodeCount).toBeLessThanOrEqual(20);
    } catch (e) {
      console.log("addNodes evaluate failed:", (e as Error).message);
      throw e;
    }
  });
});
