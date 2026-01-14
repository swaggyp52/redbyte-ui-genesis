import { test, expect } from "@playwright/test";

test("basic evaluate check - no e2e", async ({ page }) => {
  console.log("[NODE] goto /");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  console.log("[NODE] after goto /");
  
  await page.waitForTimeout(500);

  try {
    console.log("[NODE] attempting page.url()");
    const url = await page.url();
    console.log("[NODE] page.url():", url);
  } catch (e) {
    console.log("[NODE] page.url() ERROR:", (e as Error).message);
  }

  try {
    console.log("[NODE] attempting simple evaluate");
    const result = await page.evaluate(() => {
      console.log("[JS] inside evaluate");
      return 42;
    }, { timeout: 2000 });
    console.log("[NODE] evaluate result:", result);
  } catch (e) {
    console.log("[NODE] evaluate ERROR:", (e as Error).message);
  }

  expect(true).toBe(true);
});
