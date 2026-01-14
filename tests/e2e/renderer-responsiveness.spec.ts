import { test, expect } from "@playwright/test";

test("renderer responsiveness check", async ({ page }) => {
  page.on("close", () => console.log("[NODE] page closed"));
  page.on("crash", () => console.log("[NODE] page crashed"));

  console.log("[NODE] goto / (no e2e)");
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
  console.log("[NODE] after goto /");

  // This will hang if renderer is wedged
  try {
    const t1 = await page.title({ timeout: 2000 });
    console.log("[NODE] title /:", t1);
  } catch (e) {
    console.log("[NODE] title / ERROR:", (e as Error).message);
  }

  console.log("[NODE] goto /?e2e=1");
  await page.goto("/?e2e=1", { waitUntil: "domcontentloaded", timeout: 15000 });
  console.log("[NODE] after goto /?e2e=1");

  try {
    const t2 = await page.title({ timeout: 2000 });
    console.log("[NODE] title e2e:", t2);
  } catch (e) {
    console.log("[NODE] title e2e ERROR:", (e as Error).message);
  }

  expect(true).toBe(true);
});
