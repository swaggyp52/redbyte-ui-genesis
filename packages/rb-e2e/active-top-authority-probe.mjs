// P1-A/G validation — the active top has ONE authority (the store). Through the
// real Project UI: read the projected Top chip, Set Active Top, confirm the
// store field changed, reload, confirm it persisted. Store is read only to
// assert the single-authority value; the edit itself is through the UI.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const storeTop = () => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().activeTop);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);

// Load the Half Adder so the Project overview (LoadedProjectOverview) renders.
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(400);
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(700);

// The store seeded activeTop from the example name.
let top = await storeTop();
if (top !== 'half_adder') fail(`seeded activeTop expected half_adder, got ${top}`);

// The Overview Top chip must project the SAME value.
const chip = page.getByTestId('ide-project-active-top');
if (await chip.count() === 0) fail('Top chip not rendered (LoadedProjectOverview missing)');
const chipText = (await chip.first().textContent()) ?? '';
if (!chipText.includes('half_adder')) fail(`Top chip does not show store value: "${chipText}"`);
console.log(`① store activeTop=half_adder projected in the Top chip: "${chipText.trim()}"`);

// Set Active Top through the UI.
await page.getByTestId('ide-project-set-active-top').first().click(); await page.waitForTimeout(150);
await page.getByTestId('ide-project-active-top-input').first().fill('my_ripple_top');
await page.getByTestId('ide-project-active-top-confirm').first().click(); await page.waitForTimeout(300);

top = await storeTop();
if (top !== 'my_ripple_top') fail(`after UI set, store activeTop expected my_ripple_top, got ${top}`);
console.log('② UI Set Active Top → store.activeTop = my_ripple_top (single authority updated)');

// Invalid input is rejected and does not mutate the authority.
await page.getByTestId('ide-project-set-active-top').first().click(); await page.waitForTimeout(150);
await page.getByTestId('ide-project-active-top-input').first().fill('9-bad name');
await page.getByTestId('ide-project-active-top-confirm').first().click(); await page.waitForTimeout(250);
top = await storeTop();
if (top !== 'my_ripple_top') fail(`invalid input mutated authority to ${top}`);
if (await page.getByTestId('ide-project-active-top-error').count() === 0) fail('no validation error shown for bad input');
console.log('③ invalid identifier rejected; authority unchanged (my_ripple_top)');

// Reload — the persisted store restores the same active top (no second owner to drift).
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
top = await storeTop();
if (top !== 'my_ripple_top') fail(`after reload, activeTop expected my_ripple_top, got ${top}`);
console.log('④ reload restores activeTop=my_ripple_top from the persisted store');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — active top has one persisted authority; the UI projects and commands it.');
await browser.close();
