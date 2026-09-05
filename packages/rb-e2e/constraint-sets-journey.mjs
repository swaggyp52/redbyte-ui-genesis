// P2 Chapter C — named XDC constraint sets are live in Board & Constraints.
// A project may carry several constraint sets (Vivado constrs_N) with exactly
// one active; the store is their single owner and they persist across reload.
// Importing a project with XDC sources seeds a set per file. This journey drives
// the real UI: activate, rename, reload-persist, remove — reading set ids from
// the store to target rows. Runs at 1440×900 and 1366×768.
import { BASE_URL, launchChromium } from './harness.mjs';

const browser = await launchChromium();
const fail = (m) => { throw new Error(m); };

const PROJECT = {
  kind: 'rb-project', version: 1,
  name: 'Constrained (imported)', createdAt: 'x', updatedAt: 'x',
  circuit: {
    nodes: [
      { id: 'a', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'ld', type: 'OUTPUT', position: { x: 160, y: 0 } },
    ],
    connections: [{ from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'ld', portName: 'in' } }],
  },
  hdl: {
    top: 'top',
    sources: [
      { path: 'constraints/basys3.xdc', language: 'xdc', text: 'set_property PACKAGE_PIN V17 [get_ports a]\nset_property PACKAGE_PIN U16 [get_ports led]' },
      { path: 'constraints/variant.xdc', language: 'xdc', text: 'set_property PACKAGE_PIN W17 [get_ports a]' },
    ],
  },
};

const sets = (page) => page.evaluate(() => {
  const d = window.__RB_PROJECT_RUNTIME__.getState().constraintSets;
  return { activeId: d.activeId, sets: d.sets.map((s) => ({ id: s.id, name: s.name })) };
});

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.evaluate((project) => window.__RB_PROJECT_RUNTIME__.getState().loadFromProject(project), PROJECT);
  await page.waitForTimeout(250);

  // Imported XDC files seed one constraint set each.
  let model = await sets(page);
  if (model.sets.length !== 2) fail(`expected 2 seeded sets, got ${JSON.stringify(model)}`);
  const first = model.sets[0].id;
  const second = model.sets[1].id;
  console.log(`[${width}×${height}] ⓪ two constraint sets seeded from imported XDC`);

  await page.getByTestId('mode-button-hardware').click();
  await page.waitForTimeout(500);

  // ① Panel mounted in Board & Constraints; two sets; first active; pins parsed.
  if (await page.getByTestId('ide-constraint-sets').count() === 0) fail('constraint-sets panel not mounted in Board & Constraints');
  const count = (await page.getByTestId('ide-constraint-sets-count').textContent())?.trim();
  if (count !== '2 sets') fail(`unexpected count: ${count}`);
  if (await page.getByTestId(`ide-constraint-set-active-${first}`).count() === 0) fail('first set is not active');
  const pins = (await page.getByTestId(`ide-constraint-set-pins-${first}`).textContent())?.trim();
  if (pins !== '2 pins') fail(`expected 2 pins on basys3 set, got ${pins}`);
  console.log(`[${width}×${height}] ① panel mounted: 2 sets, first active, ${pins} parsed`);

  // ② Activate the second set.
  await page.getByTestId(`ide-constraint-set-activate-${second}`).click();
  await page.waitForTimeout(150);
  if ((await sets(page)).activeId !== second) fail('setActive did not move the active set');
  if (await page.getByTestId(`ide-constraint-set-active-${second}`).count() === 0) fail('second set not shown active');
  console.log(`[${width}×${height}] ② activated the second set`);

  // ③ Rename the second set through the inline editor.
  await page.getByTestId(`ide-constraint-set-rename-${second}`).click();
  await page.waitForTimeout(100);
  await page.getByTestId(`ide-constraint-set-rename-input-${second}`).fill('Variant rev B');
  await page.getByTestId(`ide-constraint-set-rename-input-${second}`).press('Enter');
  await page.waitForTimeout(150);
  const renamed = (await sets(page)).sets.find((s) => s.id === second)?.name;
  if (renamed !== 'Variant rev B') fail(`rename failed: ${renamed}`);
  console.log(`[${width}×${height}] ③ renamed the active set → "${renamed}"`);

  // ④ Reload preserves the sets and the active choice.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const afterReload = await sets(page);
  if (afterReload.sets.length !== 2) fail(`sets not preserved across reload: ${JSON.stringify(afterReload)}`);
  if (afterReload.activeId !== second) fail('active choice not preserved across reload');
  await page.getByTestId('mode-button-hardware').click();
  await page.waitForTimeout(400);
  if (await page.getByTestId(`ide-constraint-set-active-${second}`).count() === 0) fail('active set lost after reload');
  console.log(`[${width}×${height}] ④ reload preserved both sets + active choice`);

  // ⑤ Removing the active set falls activation back to the first remaining.
  await page.getByTestId(`ide-constraint-set-remove-${second}`).click();
  await page.waitForTimeout(150);
  const afterRemove = await sets(page);
  if (afterRemove.sets.length !== 1) fail(`remove failed: ${JSON.stringify(afterRemove)}`);
  if (afterRemove.activeId !== first) fail('activation did not fall back after removing the active set');
  console.log(`[${width}×${height}] ⑤ removed the active set; activation fell back to the first`);

  // ⑥ No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  console.log(`[${width}×${height}] ⑥ no horizontal overflow (${overflow}px)`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — constraint sets live in Board & Constraints at 1440×900 and 1366×768.');
