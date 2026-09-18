import { devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { addShakeFromLabel, completeSetup, createInvite, signUpThroughUi } from './helpers.js';

const shots = path.join('test-results', 'screens');
fs.mkdirSync(shots, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });

async function expectNoSeriousA11y(page: Page, label: string): Promise<void> {
  // Judge the settled screen: let running CSS animations (toast fade-in, sheet slide) finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe.serial('Mother journey on an iPhone-sized screen', () => {
  let token: string;
  let context: BrowserContext;
  let page: Page;
  // One phone, one continuous session: cookies and IndexedDB persist across the steps.
  test.beforeAll(async ({ browser }) => {
    token = createInvite('Mom');
    const { defaultBrowserType: _b, ...iphone } = devices['iPhone 14']!;
    context = await browser.newContext(iphone);
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('invite → setup confirms her presets → Today', async () => {
    await signUpThroughUi(page, token, 'Mom');
    await expect(page).toHaveURL('http://localhost:8790/');
    await expect(page.getByLabel('Carbs g').first()).toHaveValue('130');
    await expect(page.getByLabel('Carbs g').nth(1)).toHaveValue('165');
    await expectNoSeriousA11y(page, 'setup');
    await shot(page, '01-setup');
    await completeSetup(page);
    await expect(page.getByRole('listitem', { name: /Protein: 0 of 140 grams/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rest day' })).toHaveAttribute('aria-pressed', 'true');
    await expectNoSeriousA11y(page, 'today-empty');
    await shot(page, '02-today-empty');

    // The invite was consumed by the redeem; a link preview or replay cannot reuse it.
    const peek = await page.request.post('/api/v1/auth/invite/peek', { headers: { 'x-daily-plate': '1' }, data: { token } });
    expect(await peek.json()).toMatchObject({ valid: false });
    // Opening the old link while signed in simply shows the app, never a second account.
    await page.goto(`/#invite=${token}`);
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page).toHaveURL('http://localhost:8790/');
  });

  test('N02: label entry, preview before add, unknown stays unknown', async () => {
    await page.goto('/');
    await addShakeFromLabel(page);
    await expect(page.getByText('Adds 30 g protein and 15 g carbs, fat not known.')).toBeVisible();
    await page.getByRole('button', { name: '1½' }).click();
    await expect(page.getByText('Adds 45 g protein and 22.5 g carbs, fat not known.')).toBeVisible();
    await expectNoSeriousA11y(page, 'portion-sheet');
    await shot(page, '03-portion-sheet');
    await page.getByRole('button', { name: 'Add to this day' }).click();
    // She stays on Add Food to add the next thing; Done takes her to Today.
    await expect(page.getByText(/1 added to Today/)).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Protein: 45 of 140 grams. 95 g left/ })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Carbs: 23 of 130 grams. 108 g left/ })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Fat: 0 of 45 grams. 45 g left. 1 food missing fat/ })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Sugar: 0 g known, 1 food unknown/ })).toBeVisible();
    await expect(page.getByText('Some foods are missing numbers')).toBeVisible();
    await expect(page.getByRole('button', { name: /waiting to save/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /My shake, 1.5 bottles/ })).toBeVisible();
    await expectNoSeriousA11y(page, 'today-logged');
    await shot(page, '04-today-logged');
  });

  test('U05: change the amount, move to yesterday, remove, undo', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: /My shake, 1.5 bottles/ }).click();
    await page.getByRole('button', { name: '1 bottle', exact: true }).click();
    await page.getByRole('button', { name: 'Save change' }).click();
    await expect(page.getByRole('listitem', { name: /Protein: 30 of 140 grams/ })).toBeVisible();
    await page.getByRole('button', { name: /^My shake, 1 bottle/ }).click();
    await page.getByRole('button', { name: 'Move to another day' }).click();
    await page.getByRole('button', { name: 'Yesterday', exact: true }).click();
    await expect(page.getByText('Nothing logged yet')).toBeVisible();
    await page.getByRole('button', { name: /^Yesterday,/ }).click();
    await expect(page.getByRole('heading', { name: 'Yesterday' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My shake, 1 bottle/ })).toBeVisible();
    await shot(page, '05-yesterday');
    await page.getByRole('button', { name: /^My shake, 1 bottle/ }).click();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Removed My shake')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: /^My shake, 1 bottle/ })).toBeVisible();
    await page.getByRole('button', { name: 'Back to today' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  test('U06: training toggle changes only this day', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Training day' }).click();
    await expect(page.getByRole('listitem', { name: /Protein: 0 of 145 grams/ })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Carbs: 0 of 165 grams/ })).toBeVisible();
    await page.getByRole('button', { name: /^Yesterday,/ }).click();
    await expect(page.getByRole('listitem', { name: /Protein: 30 of 140 grams/ })).toBeVisible();
    await page.getByRole('button', { name: 'Back to today' }).click();
    await page.getByRole('button', { name: 'Rest day' }).click();
    await expect(page.getByRole('listitem', { name: /Protein: 0 of 140 grams/ })).toBeVisible();
  });

  test('U01/U02: pin, one-tap add with Undo, accidental double-tap adds once', async () => {
    await page.goto('/foods');
    await page.getByRole('button', { name: /My shake/ }).click();
    await expect(page.getByRole('dialog', { name: 'My shake' })).toBeVisible();
    await expect(page.getByLabel('Pinned amount')).toHaveValue('1.5'); // her last deliberate amount is proposed, never forced
    await page.getByLabel('Pinned amount').fill('1');
    await page.getByRole('button', { name: 'Pin', exact: true }).click();
    await expect(page.getByText('Pinned to Today')).toBeVisible();
    await page.getByLabel('New name').fill('shake');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Name added')).toBeVisible();
    await expectNoSeriousA11y(page, 'food-detail');
    await shot(page, '06-food-detail');
    await page.getByRole('button', { name: 'Close' }).click();
    await expectNoSeriousA11y(page, 'my-foods');
    await shot(page, '07-my-foods');

    await page.getByRole('link', { name: 'Today' }).click();
    await expect(page.getByText('Quick add')).toBeVisible();
    await page.getByRole('button', { name: 'Add My shake, 1 bottle' }).click();
    await expect(page.getByText('Added My shake — 1 bottle')).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Protein: 30 of 140 grams/ })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('listitem', { name: /Protein: 0 of 140 grams/ })).toBeVisible();

    // An accidental double-tap (two taps within the acknowledgement window) adds once.
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Add My shake, 1 bottle' }).dblclick();
    await expect(page.getByRole('listitem', { name: /Protein: 30 of 140 grams/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My shake, 1 bottle/ })).toHaveCount(1);
    await shot(page, '08-quick-add');

    // A deliberate second tap after the acknowledgement is a real second serving.
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Add My shake, 1 bottle' }).click();
    await expect(page.getByRole('listitem', { name: /Protein: 60 of 140 grams/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My shake, 1 bottle/ })).toHaveCount(2);
  });

  test('U03/U09: phrase parsing, alias search, save-to-finish-later, resolve later', async () => {
    await page.goto('/add');
    await page.getByLabel('What did you have?').fill('half shake');
    await expect(page.getByText('Amount 0.5 · searching "shake"')).toBeVisible();
    await page.getByRole('button', { name: /^My shake/ }).first().click();
    await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('0.5');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByLabel('What did you have?').fill('restaurant salmon plate');
    await page.getByLabel('What did you have?').press('Enter'); // Search means search, never "open the first local hit"
    await expect(page.getByText('No match for "restaurant salmon plate"')).toBeVisible();
    await page.getByRole('button', { name: 'Save to finish later' }).click();
    await page.getByRole('button', { name: 'Save for later' }).click();
    await expect(page.getByRole('button', { name: /restaurant salmon plate, not finished/ })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Protein: 60 of 140 grams/ })).toBeVisible();
    await shot(page, '09-draft');
    await page.getByRole('button', { name: /restaurant salmon plate, not finished/ }).click();
    await page.getByRole('button', { name: 'Find this food' }).click();
    await page.getByLabel('What did you have?').fill('shake');
    await page.getByRole('button', { name: /^My shake/ }).first().click();
    await page.getByRole('button', { name: 'Add to this day' }).click();
    await expect(page.getByText('Finished: My shake')).toBeVisible();
    await expect(page.getByRole('button', { name: /not finished/ })).toHaveCount(0);
    await expect(page.getByRole('listitem', { name: /Protein: 90 of 140 grams/ })).toBeVisible();
  });

  test('O01: log while offline, close and reopen, reconcile without duplicates', async ({ browserName }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: /waiting to save/ })).toHaveCount(0);
    // Cut the network only once the app shell is installed and controlling this page; the first
    // registration of a service worker does not control the page that registered it until the next load.
    const controlled = async (): Promise<boolean> =>
      page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        await navigator.serviceWorker.ready;
        return navigator.serviceWorker.controller !== null;
      });
    if (!(await controlled())) {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    }
    if (browserName === 'chromium') expect(await controlled(), 'service worker controls the page before going offline').toBe(true);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add My shake, 1 bottle' }).click();
    await expect(page.getByText('Waiting to save', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /1 waiting to save/ })).toBeVisible();
    await shot(page, '10-offline-pending');
    await page.close();
    const reopened = await context.newPage();
    page = reopened;
    await reopened.goto('/').catch(() => undefined);
    // Opening the app with no network at all is served by the service-worker shell.
    // Playwright's Chromium proves that path; its WebKit build does not serve the
    // shell under setOffline, so there the journey records what it rendered and
    // continues with the part that matters most: the pending entry survives the
    // close/reopen on the phone and reconciles exactly once when the network returns.
    const shellOffline = await reopened
      .getByText('Waiting to save', { exact: true })
      .waitFor({ timeout: 10_000 })
      .then(() => true, () => false);
    if (browserName === 'chromium') expect(shellOffline, 'offline app-shell open').toBe(true);
    if (!shellOffline) {
      await shot(reopened, '10b-offline-reopen-no-shell');
      test.info().annotations.push({ type: 'engine', description: `${browserName}: offline app-shell open not served under Playwright setOffline; verified in Chromium` });
    }
    await context.setOffline(false);
    if (!shellOffline) {
      await reopened.goto('/');
      await expect(reopened.getByRole('heading', { name: 'Today' })).toBeVisible();
    }
    // The app retries on its own when the connection returns; the badge is also tappable.
    await reopened.getByRole('button', { name: /1 waiting to save/ }).click({ timeout: 2000 }).catch(() => undefined);
    await expect(reopened.getByRole('button', { name: /waiting to save/ })).toHaveCount(0, { timeout: 20_000 });
    await expect(reopened.getByText('Waiting to save', { exact: true })).toHaveCount(0);
    await reopened.reload();
    await expect(reopened.getByRole('listitem', { name: /Protein: 120 of 140 grams/ })).toBeVisible();
    // Two quick adds + the resolved draft + the offline add: four, never five.
    await expect(reopened.getByRole('button', { name: /^My shake, 1 bottle/ })).toHaveCount(4);
  });

  test('Ideas from my foods are arithmetic and never automatic', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ideas from my foods' }).click();
    await expect(page.getByRole('dialog', { name: 'Ideas from my foods' })).toBeVisible();
    // Shake has unknown fat, so it is not eligible; no other complete food is saved.
    await expect(page.getByText('No saved food fits')).toBeVisible();
    await shot(page, '11-ideas');
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('Settings and My Foods pass the accessibility scan; nothing exceeds the phone width', async () => {
    await page.goto('/settings');
    await expectNoSeriousA11y(page, 'settings');
    await shot(page, '12-settings');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.goto('/add');
    await expectNoSeriousA11y(page, 'add-food');
    await shot(page, '13-add-food');
  });

  test('D07-lite: passkey registration and unlock with a virtual authenticator; pending work survives lock', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'The virtual authenticator is a Chromium CDP feature; WebKit/Safari passkeys are a physical-device check.');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Add unlock on this phone' }).click();
    await expect(page.getByText('Unlock added')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out on this phone' }).click();
    await page.getByRole('button', { name: 'Sign out (keep this phone\'s copy)' }).click();
    await expect(page.getByRole('heading', { name: /Welcome back, Mom/ })).toBeVisible();
    await shot(page, '14-unlock');
    await page.getByRole('button', { name: 'See my diary without saving' }).click();
    await expect(page.getByText('Viewing only')).toBeVisible();
    await page.getByRole('link', { name: 'Today' }).click();
    await page.getByRole('button', { name: 'Add My shake, 1 bottle' }).click();
    await expect(page.getByText('Waiting to save', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unlock', exact: true }).first().click();
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: /waiting to save/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^My shake, 1 bottle/ })).toHaveCount(5);
  });
});
