// P1-E — the Pin Planner in Board & Constraints: an electrically-aware
// assignment table over the mapping authority with conflict detection, one-
// click repair, exact XDC before/after, and one-action undo. Through the real
// UI: read the electrical table, create a pin conflict via a pin field, see it
// flagged + the XDC consequence, resolve it, and confirm it clears. The store
// is read only to find entry ids and assert; edits are real pin-field / button
// interactions.
import { BASE_URL, launchChromium } from './harness.mjs';
const browser = await launchChromium();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const conflicts = () => page.evaluate(() => {
  const doc = window.__RB_PROJECT_RUNTIME__.getState().hardwareMappingV2;
  const byPin = {};
  for (const e of doc.entries) {
    const pins = e.kind === 'scalar' || e.kind === 'bit' ? [e.pin] : e.kind === 'slice' ? e.pins : e.kind === 'bus' ? e.bits.map(b => b.pin) : [];
    for (const p of pins) if (p) byPin[p] = (byPin[p] ?? 0) + 1;
  }
  return Object.values(byPin).filter(n => n > 1).length;
});

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(400);

// Entry ids for the two switch inputs (scalar entries).
const ids = await page.evaluate(() => {
  const doc = window.__RB_PROJECT_RUNTIME__.getState().hardwareMappingV2;
  const scalars = doc.entries.filter((e) => e.kind === 'scalar' && e.direction === 'in');
  return { sw0: scalars[0]?.id, sw1: scalars[1]?.id, sw0Pin: scalars[0]?.pin, sw1Pin: scalars[1]?.pin };
});
if (!ids.sw0 || !ids.sw1) fail(`could not find two input scalars: ${JSON.stringify(ids)}`);

await page.getByTestId('mode-button-hardware').click(); await page.waitForTimeout(1200);
if (await page.getByTestId('ide-pin-planner').count() === 0) fail('Pin Planner did not render');
if (await page.getByTestId('ide-pin-planner-table').count() === 0) fail('Pin Planner table missing');
console.log('① Pin Planner renders in Board & Constraints');

// Electrical resource is shown for a mapped switch pin.
const sw0Row = page.getByTestId(`ide-pin-planner-row-${ids.sw0}`);
if (await sw0Row.count() === 0) fail('SW0 row not in planner table');
const sw0Resource = (await sw0Row.locator('.ide-pin-planner-resource').textContent()) ?? '';
if (!/[A-Z]\d/.test(sw0Resource)) fail(`SW0 resource cell should show a board resource+pin: "${sw0Resource}"`);
console.log(`② electrical metadata shown for SW0 (${ids.sw0Pin}): "${sw0Resource.trim()}"`);

if (await conflicts() !== 0) fail('expected no conflicts initially');

// Create a conflict: set SW1's pin to SW0's pin through the pin field.
const sw1Input = page.getByTestId(`ide-pin-planner-pin-input-${ids.sw1}`);
await sw1Input.click();
await sw1Input.fill(ids.sw0Pin);
await sw1Input.press('Enter');
await page.waitForTimeout(400);
if (await conflicts() !== 1) fail(`expected 1 store conflict after duplicate pin, got ${await conflicts()}`);
const conflictCount = (await page.getByTestId('ide-pin-planner-conflict-count').textContent())?.trim();
if (!/1 conflict/.test(conflictCount ?? '')) fail(`planner should show 1 conflict, got "${conflictCount}"`);
console.log(`③ duplicate pin ${ids.sw0Pin} flagged: "${conflictCount}"`);

// The XDC before/after consequence of that pin edit is shown.
if (await page.getByTestId('ide-pin-planner-xdc-diff').count() === 0) fail('XDC before/after not shown after a pin edit');
const added = await page.getByTestId('ide-pin-planner-xdc-added').count();
const removed = await page.getByTestId('ide-pin-planner-xdc-removed').count();
if (added < 1 || removed < 1) fail(`XDC diff should show added+removed lines (added=${added} removed=${removed})`);
console.log(`④ exact XDC before/after shown (+${added} −${removed} lines)`);

// Resolve the conflict via the one-click repair.
const resolveBtn = page.getByTestId(`ide-pin-planner-resolve-${ids.sw0Pin}`);
if (await resolveBtn.count() === 0) fail('resolve button not shown for the conflict');
await resolveBtn.first().click(); await page.waitForTimeout(400);
if (await conflicts() !== 0) fail(`conflict not resolved (store still has ${await conflicts()})`);
const afterCount = (await page.getByTestId('ide-pin-planner-conflict-count').textContent())?.trim();
if (!/0 conflict/.test(afterCount ?? '')) fail(`planner should show 0 conflicts after repair, got "${afterCount}"`);
console.log('⑤ one-click repair cleared the conflict (kept the first signal)');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — Pin Planner: electrical table, conflict detect + repair, exact XDC before/after.');
await browser.close();
