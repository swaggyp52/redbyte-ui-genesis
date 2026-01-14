import { test, expect } from "@playwright/test";

test("evaluate sanity matrix", async ({ page }) => {
  console.log("[NODE] A: about:blank");
  await page.goto("about:blank");
  const a = await page.evaluate(() => 42);
  console.log("[NODE] A ok:", a);

  console.log("[NODE] B: data: url");
  await page.goto("data:text/html,<title>t</title><script>console.log('hi')</script>");
  const b = await page.evaluate(() => 43);
  console.log("[NODE] B ok:", b);

  console.log("[NODE] C: setContent");
  await page.setContent("<!doctype html><title>x</title><script>console.log('x')</script>");
  const c = await page.evaluate(() => 44);
  console.log("[NODE] C ok:", c);

  console.log("[NODE] D: your app /");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // keep this tiny: prove Runtime works at all
  const d = await page.evaluate(() => 45);
  console.log("[NODE] D ok:", d);

  expect([a, b, c, d]).toEqual([42, 43, 44, 45]);
});
