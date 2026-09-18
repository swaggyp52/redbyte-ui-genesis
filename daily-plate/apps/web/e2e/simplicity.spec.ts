import { devices, expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { reconnectThroughUi, seedAccount } from './helpers.js';

const shots = path.join('test-results', 'screens');
fs.mkdirSync(shots, { recursive: true });
/** Evidence screenshots show the settled screen: sheet animations finished and short-lived toasts gone. */
async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 9000 });
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage });
}

/**
 * Simplicity checks on a lived-in account (about 100 days of use). These are
 * regression checks against avoidable friction, not a score: the number of
 * deliberate interactions a familiar task needs, and what the first screen
 * answers without scrolling.
 */
test.describe.serial('Open, understand today, add with almost no effort', () => {
  let context: BrowserContext;
  let page: Page;
  let taps = 0;
  /** One deliberate interaction by her (a tap or a typed field). */
  const act = async (run: () => Promise<void>): Promise<void> => {
    taps += 1;
    await run();
  };
  const startTask = (): void => {
    taps = 0;
  };

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

  async function inFirstViewport(locator: Locator, what: string): Promise<void> {
    const vh = page.viewportSize()!.height;
    const box = await locator.boundingBox();
    expect(box, `${what} is rendered`).not.toBeNull();
    expect(box!.y, `${what} starts inside the first screen`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `${what} ends inside the first screen`).toBeLessThanOrEqual(vh + 1);
  }
  async function noOverflow(): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
  const macro = (name: string) => page.getByRole('listitem', { name: new RegExp(`^${name}: `) });

  test('A. Open Today: date, Rest/Training, protein, carbs and fat eaten and left, and Add Food, all without scrolling', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await inFirstViewport(page.getByRole('heading', { name: 'Today' }), 'the day');
    await inFirstViewport(page.locator('.today-date'), 'the date');
    await inFirstViewport(page.getByRole('group', { name: 'Day type' }), 'Rest/Training');
    await expect(page.getByRole('button', { name: 'Training day' })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['Protein', 'Carbs', 'Fat']) {
      const row = macro(name);
      await inFirstViewport(row, name);
      const label = (await row.getAttribute('aria-label')) ?? '';
      // Both numbers are stated; she never subtracts.
      expect(label).toMatch(new RegExp(`^${name}: (about )?\\d+ of \\d+ grams\\. \\d+ g (left|over)`));
    }
    await inFirstViewport(page.getByRole('list', { name: 'Also today' }), 'fiber and sugar');
    await inFirstViewport(page.getByRole('link', { name: 'Add Food' }), 'Add Food');
    // Nothing to decode: no source names on the home screen.
    await expect(page.getByText(/USDA|Open Food Facts|provider|sync|mutation/i)).toHaveCount(0);
  });

  test('B. Add a pinned food: one tap from Today', async () => {
    startTask();
    const before = (await macro('Protein').getAttribute('aria-label')) ?? '';
    await act(() => page.getByRole('button', { name: 'Add My shake, 1 bottle' }).click());
    await expect(page.getByText('Added My shake — 1 bottle')).toBeVisible();
    await expect(macro('Protein')).not.toHaveAttribute('aria-label', before);
    expect(taps).toBe(1);
  });

  test('C. Add a recent food: Add Food, tap it, confirm the usual amount', async () => {
    startTask();
    await act(() => page.getByRole('link', { name: 'Add Food' }).click());
    await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible();
    await shot(page, '43-add-food-start');
    // Rows already show her last amount and what it adds.
    await expect(page.getByRole('button', { name: /^Chicken breast, cooked/ }).first()).toContainText(/breast.*protein/);
    await act(() => page.getByRole('button', { name: /^Chicken breast, cooked/ }).first().click());
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await expect(sheet.getByRole('textbox', { name: 'Amount' })).toHaveValue('1');
    await expect(sheet.getByRole('button', { name: /^1 breast/ })).toBeVisible(); // the useful portion, not grams
    await act(() => sheet.getByRole('button', { name: 'Add to this day' }).click());
    await expect(page.getByText(/1 added to Today/)).toBeVisible();
    expect(taps).toBeLessThanOrEqual(3);
  });

  test('D. Search an unfamiliar food: search, pick, amount, add', async () => {
    startTask();
    await act(() => page.getByLabel('What did you have?').fill('banana'));
    await act(() => page.getByLabel('What did you have?').press('Enter'));
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByRole('button', { name: /^Bananas, raw/ })).toBeVisible();
    // Result rows say what matters: name, then protein · carbs · fat; no source names.
    await expect(results.getByRole('button', { name: /^Bananas, raw/ })).toContainText(/protein · .*carbs · .*fat/);
    await expect(results).not.toContainText(/USDA|Product/);
    await shot(page, '44-search-results');
    await act(() => results.getByRole('button', { name: /^Bananas, raw/ }).click());
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await shot(page, '45-portion');
    await act(() => sheet.getByRole('button', { name: 'Add to this day' }).click());
    await expect(page.getByText(/2 added to Today/)).toBeVisible();
    expect(taps).toBeLessThanOrEqual(4);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await shot(page, '40-today-typical');
    await shot(page, '40-today-typical-full', true);
  });

  test('E. Change an amount already logged: entry, amount, save', async () => {
    startTask();
    const before = (await macro('Protein').getAttribute('aria-label')) ?? '';
    await act(() => page.getByRole('button', { name: /^My shake, 1 bottle/ }).first().click());
    const sheet = page.getByRole('dialog', { name: 'Change this entry' });
    await act(() => sheet.getByRole('button', { name: '½ bottle', exact: true }).click());
    await act(() => sheet.getByRole('button', { name: 'Save change' }).click());
    await expect(page.getByRole('button', { name: /^My shake, 0.5 bottles/ })).toBeVisible();
    await expect(macro('Protein')).not.toHaveAttribute('aria-label', before);
    expect(taps).toBeLessThanOrEqual(3);
  });

  test('F. Switch Rest/Training: one tap; eaten stays, goals and left change, nothing moves', async () => {
    startTask();
    const eatenBefore = ((await macro('Carbs').getAttribute('aria-label')) ?? '').match(/(\d+) of 165 grams/)?.[1];
    const docTop = () => page.getByRole('list', { name: 'Daily goals' }).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const topBefore = await docTop();
    await act(() => page.getByRole('button', { name: 'Rest day' }).click());
    await expect(macro('Carbs')).toHaveAttribute('aria-label', new RegExp(`^Carbs: ${eatenBefore} of 130 grams`));
    await expect(macro('Protein')).toHaveAttribute('aria-label', /of 140 grams/);
    expect(Math.abs((await docTop()) - topBefore)).toBeLessThan(2); // the page does not reflow under her
    expect(taps).toBe(1);
    await page.getByRole('button', { name: 'Training day' }).click();
    await expect(macro('Carbs')).toHaveAttribute('aria-label', /of 165 grams/);
  });

  test('G. Repeat a previous meal: yesterday, the meal, preview, add', async () => {
    startTask();
    await act(() => page.getByRole('button', { name: /^Yesterday,/ }).click());
    await expect(page.getByRole('heading', { name: 'Yesterday' })).toBeVisible();
    await act(() => page.getByRole('button', { name: 'Add this to today' }).nth(1).click());
    const sheet = page.getByRole('dialog', { name: /Add lunch from yesterday to today/ });
    await expect(sheet.getByRole('button', { name: /^Add \d+ items/ })).toBeVisible();
    await shot(page, '46-meal-preview');
    await act(() => sheet.getByRole('button', { name: /^Add \d+ items/ }).click());
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    expect(taps).toBeLessThanOrEqual(4);
  });

  test('Over a goal reads as "over", in neutral words', async () => {
    await page.getByRole('link', { name: 'Add Food' }).click();
    await page.getByLabel('What did you have?').fill('peanut');
    await page.getByRole('button', { name: /^Peanut butter/ }).first().click();
    const sheet = page.getByRole('dialog', { name: 'How much?' });
    await sheet.getByRole('button', { name: 'g', exact: true }).click();
    await sheet.getByRole('textbox', { name: 'Amount' }).fill('120');
    await sheet.getByRole('button', { name: 'Add to this day' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(macro('Fat')).toHaveAttribute('aria-label', /^Fat: \d+ of 40 grams\. \d+ g over/);
    await expect(page.getByText(/over budget|bad day|failed|warning/i)).toHaveCount(0);
    await shot(page, '42-today-over');
  });

  test('Offline: adding still works and says so plainly', async () => {
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add Egg, large, 1 large' }).click();
    await expect(page.getByText('Waiting to save', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /1 waiting to save/ })).toBeVisible();
    await expect(page.getByText(/mutation|reconcil|outbox|queue/i)).toHaveCount(0);
    await shot(page, '47-offline-pending');
    await context.setOffline(false);
    await page.getByRole('button', { name: /1 waiting to save/ }).click({ timeout: 2000 }).catch(() => undefined);
    await expect(page.getByRole('button', { name: /waiting to save/ })).toHaveCount(0, { timeout: 20_000 });
  });

  test('My Foods: names first, no source jargon in the list', async () => {
    await page.getByRole('link', { name: 'My Foods' }).click();
    await expect(page.getByRole('button', { name: /^My shake/ })).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(/USDA|Open Food Facts/);
    await shot(page, '48-my-foods');
    await page.getByRole('link', { name: 'Today' }).click();
  });

  test('Text at 200%: the goals still read, nothing overlaps, no sideways scroll', async () => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await noOverflow();
    for (const name of ['Protein', 'Carbs', 'Fat']) await expect(macro(name)).toBeVisible();
    // Each figure stays on one line: no letter-by-letter wrapping of "109 g".
    const tallest = await page.locator('.macro-fig b').evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().height)));
    const fontPx = await page.locator('.macro-fig b').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(tallest).toBeLessThan(fontPx * 1.6);
    await expect(page.getByRole('button', { name: 'Training day' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Food' })).toBeVisible();
    await shot(page, '41-today-200pct');
    await shot(page, '41-today-200pct-full', true);
  });
});
