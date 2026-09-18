import { devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { reconnectThroughUi, seedAccount } from './helpers.js';

const shots = path.join('test-results', 'screens');
fs.mkdirSync(shots, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });

/**
 * Catalog journeys against fixture-backed providers (the server's test-only
 * stub). These prove the app's behaviour around search, paging, details,
 * barcodes and meals; they do not prove live USDA/OFF coverage.
 */
test.describe.serial('Catalog and repeat-use journeys (week-old account)', () => {
  let context: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    const { token } = seedAccount('week', 'Demo Mom');
    const { defaultBrowserType: _b, ...iphone } = devices['iPhone 14']!;
    context = await browser.newContext(iphone);
    page = await context.newPage();
    await reconnectThroughUi(page, token);
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('Add Food opens useful, without stealing focus into the keyboard', async () => {
    await page.getByRole('link', { name: 'Add Food' }).click();
    await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible();
    const focused = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focused).not.toBe('food-search');
    await shot(page, '20-add-food-start');
  });

  test('Search is search: generic banana ranks above banana snacks, More results pages in, database pick goes straight to the amount', async () => {
    await page.getByLabel('What did you have?').fill('banana');
    await page.getByLabel('What did you have?').press('Enter');
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByRole('button', { name: /^Bananas, raw/ })).toBeVisible();
    // Her own saved banana is listed first under "Your foods"; provider results follow under "More foods".
    await expect(page.getByRole('heading', { name: 'Your foods' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'More foods' })).toBeVisible();
    await page.getByRole('button', { name: 'More results' }).click();
    await expect(results.getByRole('button', { name: /^BANANA CHIPS|^Banana Chips/i })).toBeVisible();
    await expect(results.getByRole('button', { name: /^Bananas, ripe/ })).toBeVisible();
    await shot(page, '21-search-paged');

    await results.getByRole('button', { name: /^Bananas, raw/ }).click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('From USDA FoodData Central.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Check or edit the label' })).toBeVisible(); // secondary, not mandatory
    await expect(sheet.getByRole('button', { name: 'g', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('textbox', { name: 'Amount' }).fill('120');
    await expect(sheet.getByText(/Adds 1.3 g protein and 27.4 g carbs, 0.4 g fat/)).toBeVisible();
    await shot(page, '22-candidate-portion');
    await sheet.getByRole('button', { name: 'Add to this day' }).click();
    await expect(page.getByText(/1 added to Today/)).toBeVisible();
    // The query is cleared for the next item; the added food is now one of her foods.
    await expect(page.getByLabel('What did you have?')).toHaveValue('');
  });

  test('A stale search cannot replace the current query', async () => {
    await page.route('**/api/v1/foods/search?q=banana*', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.getByLabel('What did you have?').fill('banana');
    await page.getByLabel('What did you have?').press('Enter');
    await page.getByLabel('What did you have?').fill('rice');
    await page.getByLabel('What did you have?').press('Enter');
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByRole('button', { name: /^Rice, white, cooked, no added fat/ })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(results.getByRole('button', { name: /^Bananas/ })).toHaveCount(0);
    await page.unroute('**/api/v1/foods/search?q=banana*');
  });

  test('"2 eggs" on a USDA egg uses the household portion from the details call, never 2 g; adds a second item in the same visit', async () => {
    await page.getByLabel('What did you have?').fill('2 egg');
    await page.getByLabel('What did you have?').press('Enter');
    const results = page.getByRole('region', { name: 'Results' });
    await results.getByRole('button', { name: /^Egg, whole, raw, fresh/ }).click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet.getByRole('button', { name: 'large', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.getByRole('textbox', { name: 'Amount' })).toHaveValue('2');
    await expect(sheet.getByText('2 larges')).toBeVisible();
    await expect(sheet.getByText(/Adds 12.5 g protein/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Add to this day' }).click();
    await expect(page.getByText(/2 added to Today/)).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: /^Bananas, raw, 120 g/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Egg, whole, raw, fresh, 2 larges/ })).toBeVisible();
  });

  test('A saved meal found by search is added right there, with one part unticked', async () => {
    await page.getByRole('link', { name: 'Add Food' }).click();
    await page.getByLabel('What did you have?').fill('usual');
    await page.getByRole('button', { name: /^Usual breakfast/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Usual breakfast' });
    await sheet.getByRole('checkbox', { name: 'Include Coffee with 2% milk' }).uncheck();
    await expect(sheet.getByRole('button', { name: 'Add 2 items' })).toBeVisible();
    await shot(page, '23-meal-from-search');
    await sheet.getByRole('button', { name: 'Add 2 items' }).click();
    await expect(page.getByText(/Added Usual breakfast \(2 items\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: /^Whole wheat bread, 1 slice/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Coffee with 2% milk/ })).toHaveCount(0);
  });

  test('A saved barcode resolves on the phone while offline; an unknown code is carried into the label form and is local next time', async () => {
    await page.getByRole('link', { name: 'Add Food' }).click();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Scan barcode' }).click();
    await page.getByLabel('Barcode digits').fill('0012345678905');
    await page.getByRole('button', { name: 'Look up' }).click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet.getByRole('heading', { name: 'Granola bar, chocolate chip' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await context.setOffline(false);

    await page.getByRole('button', { name: 'Scan barcode' }).click();
    await page.getByLabel('Barcode digits').fill('999999999999');
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(page.getByText(/No product found for 999999999999/)).toBeVisible();
    await page.getByRole('status').getByRole('button', { name: 'Add from label' }).click();
    await expect(page.getByText('Barcode 999999999999 will be saved with this food')).toBeVisible();
    await page.getByLabel('Name').fill('Corner shop oat bar');
    await page.getByLabel('One serving is').fill('1 bar');
    await page.getByLabel('What do you call one serving?').fill('bar');
    await page.getByLabel('Protein in g').fill('4');
    await page.getByLabel('Carbs in g').fill('20');
    await page.getByLabel('Fat in g').fill('6');
    await page.getByLabel('Fiber kind').selectOption('unknown');
    await page.getByLabel('Sugar kind').selectOption('unknown');
    await page.getByLabel('Calories kind').selectOption('unknown');
    await page.getByRole('button', { name: 'Save food' }).click();
    await expect(sheet.getByRole('heading', { name: 'Corner shop oat bar' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Scan barcode' }).click();
    await page.getByLabel('Barcode digits').fill('999999999999');
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(sheet.getByRole('heading', { name: 'Corner shop oat bar' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();
  });

  test('A product barcode found in the product database goes straight to the amount with a carbohydrate note', async () => {
    await page.getByRole('button', { name: 'Scan barcode' }).click();
    await page.getByLabel('Barcode digits').fill('4000000000012');
    await page.getByRole('button', { name: 'Look up' }).click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet.getByRole('heading', { name: 'Example Greek Yogurt' })).toBeVisible();
    await expect(sheet.getByText('From the Open Food Facts product database.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: '170 g', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
  });

  test("Yesterday's lunch can be added to today after a preview, without changing yesterday", async () => {
    await page.getByRole('link', { name: 'Today' }).click();
    await page.getByRole('button', { name: /Change day/ }).click();
    await page.getByRole('button', { name: 'Yesterday' }).click();
    const before = await page.getByRole('button', { name: /^Chicken breast, cooked/ }).count();
    await page.getByRole('button', { name: 'Add this to today' }).nth(1).click();
    const sheet = page.getByRole('dialog', { name: /Add lunch from yesterday to today/ });
    await sheet.getByLabel('Amount of Rice, white, cooked').fill('0.5');
    await sheet.getByRole('button', { name: 'Add 2 items' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Rice, white, cooked, 0.5 cup/ })).toBeVisible();
    await page.getByRole('button', { name: /Change day/ }).click();
    await page.getByRole('button', { name: 'Yesterday' }).click();
    await expect(page.getByRole('button', { name: /^Chicken breast, cooked/ })).toHaveCount(before);
    await expect(page.getByRole('button', { name: /^Rice, white, cooked, 1 cup/ })).toBeVisible();
    await shot(page, '24-copy-yesterday');
  });

  test('The lived-in Add Food and Today screens pass the accessibility scan', async () => {
    await page.goto('/add');
    // Judge the settled screen: let running CSS animations (toast fade-in, sheet slide) finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
});
