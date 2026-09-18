import { devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { reconnectThroughUi, seedAccount } from './helpers.js';

const shots = path.join('test-results', 'screens');
fs.mkdirSync(shots, { recursive: true });

/** Several months of use: many entries, long names, a draft, a recipe, a saved meal. */
test.describe.serial('Lived-in account (about 100 days)', () => {
  let context: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    const { token } = seedAccount('months', 'Demo Mom');
    const { defaultBrowserType: _b, ...iphone } = devices['iPhone 14']!;
    context = await browser.newContext(iphone);
    page = await context.newPage();
    await reconnectThroughUi(page, token);
  });
  test.afterAll(async () => {
    await context.close();
  });

  async function noOverflow(): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }

  test('Today shows a busy day with a draft, pins, and stable primary actions', async () => {
    await expect(page.getByText('Quick add')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add My shake, 1 bottle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Usual breakfast, 3 items' })).toBeVisible();
    await noOverflow();
    await page.screenshot({ path: path.join(shots, '30-lived-in-today.png'), fullPage: true });
    // Judge the settled screen: let running CSS animations (toast fade-in, sheet slide) finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  test('History: a day three weeks back opens with its own goals and entries; long names wrap', async () => {
    await page.getByRole('button', { name: /Change day/ }).click();
    await page.getByRole('button', { name: '‹ Earlier week' }).click();
    await page.getByRole('button', { name: '‹ Earlier week' }).click();
    await page.getByRole('button', { name: '‹ Earlier week' }).click();
    await page.getByRole('group', { name: 'Days this week' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: /^Chicken breast, cooked/ })).toBeVisible();
    await noOverflow();
    await page.getByRole('button', { name: /Change day/ }).click();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
  });

  test('My Foods lists everything, finds by alias, and the recipe is logged like a food', async () => {
    await page.goto('/foods');
    await expect(page.getByRole('button', { name: /^Peanut butter, creamy, no salt added/ })).toBeVisible();
    await page.getByLabel('Find in my foods').fill('pb');
    await expect(page.getByRole('button', { name: /^Peanut butter/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Banana/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Recipes' }).click();
    await expect(page.getByRole('button', { name: /^Chicken and rice bake/ })).toBeVisible();
    await noOverflow();
    await page.goto('/add');
    await page.getByLabel('What did you have?').fill('chicken and rice bake');
    await page.getByRole('button', { name: /^Chicken and rice bake/ }).first().click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet.getByText('per 1 portion')).toBeVisible();
    await expect(sheet.getByText(/Adds 3[0-9](\.\d)? g protein/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Text at 200%: no clipped controls or horizontal overflow on Today, Add Food and a sheet', async () => {
    await page.goto('/');
    // Type is sized in rem, so a 200% root font size is how larger text reaches the layout.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noOverflow();
    await expect(page.getByRole('button', { name: 'Add My shake, 1 bottle' })).toBeVisible();
    await page.screenshot({ path: path.join(shots, '31-today-200pct.png'), fullPage: true });
    await page.getByRole('button', { name: 'Add My shake, 1 bottle' }).scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: 'Add Food' }).click();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noOverflow();
    await page.getByRole('button', { name: /^My shake/ }).first().click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet.getByRole('button', { name: 'Add to this day' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Add to this day' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, '32-sheet-200pct.png') });
    await sheet.getByRole('button', { name: 'Cancel' }).click();
  });
});
