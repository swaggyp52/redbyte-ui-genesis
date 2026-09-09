// Seeded integration setup; all mapping operations use the UI. Store reads assert outcomes.
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const browser = await launchChromium();
const out = evidenceDir('astra-board-context');
const results = [];
const fail = (message) => { throw new Error(message); };
const mapping = (page) => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().hardwareMappingV2.entries);
const pin = async (page, id) => (await mapping(page)).find(entry => entry.id === id)?.pin;
const assertPin = async (page, id, expected) => { if (await pin(page, id) !== expected) fail(`${id}: expected pin ${expected}, got ${await pin(page, id)}`); };

try {
  for (const [width, height] of [[1440, 900], [1280, 650]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
    const [a, b] = (await mapping(page)).filter(e => e.kind === 'scalar' && e.direction === 'in');
    if (!a || !b) fail('two input mappings required');
    await page.getByTestId('mode-button-hardware').click();
    const table = page.getByTestId('ide-hw-map-table');
    await table.waitFor();
    if ((await table.locator('thead th').allTextContents()).join('|') !== 'Logical port|Board resource|State|Action') fail('primary mapping relation is not compact');
    if (/Artifact port|Package pin/.test(await table.innerText())) fail('technical identities leaked into primary relation');
    const reference = page.getByTestId('ide-hw-constraints-tool');
    if (await reference.evaluate(el => el.open)) fail('constraint catalog is open on arrival');

    await page.getByTestId(`ide-hw-map-row-action-${a.id}`).focus();
    await page.keyboard.press('Enter');
    if (!(await page.getByTestId('ide-hardware-chain-pin').innerText()).includes(a.pin)) fail('saved detail did not follow selection');
    const originalXdc = await page.getByTestId('ide-hardware-basys3-binding-xdc').innerText();
    await page.getByTestId('ide-hw-direct-resource-select').selectOption('SW2');
    await assertPin(page, a.id, a.pin);
    if (await page.getByTestId('ide-hardware-basys3-binding-xdc').innerText() !== originalXdc) fail('unsaved resource replaced saved XDC');
    await page.getByTestId('ide-hw-assign-selected-resource').click();
    await assertPin(page, a.id, 'W16');
    if (!(await page.getByTestId('ide-hardware-basys3-binding-xdc').innerText()).includes('PACKAGE_PIN W16')) fail('saved XDC did not update');
    await page.getByTestId('ide-hw-map-sw-3-hit').click();
    await assertPin(page, a.id, 'W17');
    await page.getByTestId('ide-hw-map-sw-4').locator('..').focus();
    await page.keyboard.press('Enter');
    await assertPin(page, a.id, 'W15');
    await page.getByTestId('ide-hw-undo-assignment').click();
    await assertPin(page, a.id, 'W17');
    await page.getByTestId('ide-hw-clear-selected-resource').click();
    await assertPin(page, a.id, '');
    await page.getByTestId('ide-hw-use-recommended').click();
    await assertPin(page, a.id, a.pin);
    const geometry = await page.evaluate(() => ({
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panes: [...document.querySelectorAll('.rb-board-assignments,.rb-board-stage,.rb-board-side')].map(el => ({ className: el.className, width: el.clientWidth, height: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight })),
      actions: [...document.querySelectorAll('.rb-board-row-action, [data-testid="ide-hw-direct-resource-select"], [data-testid="ide-hw-clear-selected-resource"]')].map(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { text: el.getAttribute('aria-label') ?? el.textContent, inViewport: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, hit: !!hit && (el === hit || el.contains(hit)) }; }),
    }));
    if (geometry.rootOverflow > 1 || geometry.panes.some(p => p.scrollWidth > p.width + 1)) fail(`horizontal overflow: ${JSON.stringify(geometry)}`);
    if (geometry.actions.some(action => !action.inViewport || !action.hit)) fail(`mapping controls are not reachable: ${JSON.stringify(geometry.actions)}`);
    await page.screenshot({ path: path.join(out, `after-board-${width}x${height}.png`) });

    await page.getByTestId(`ide-hw-map-row-action-${b.id}`).click();
    const electrical = page.getByTestId('ide-hw-electrical-detail');
    if (await electrical.evaluate(el => el.open)) fail('electrical editor must start closed');
    await electrical.locator('summary').click();
    if (await page.getByTestId(`ide-pin-planner-pin-input-${a.id}`).count()) fail('unselected electrical field rendered');
    const input = page.getByTestId(`ide-pin-planner-pin-input-${b.id}`);
    await input.fill(a.pin);
    await input.press('Enter');
    await assertPin(page, b.id, a.pin);
    if (!(await page.getByTestId('ide-pin-planner-conflict-count').innerText()).includes('1 conflict')) fail('global conflict not shown');
    if (await page.getByTestId('ide-pin-planner-xdc-added').count() < 1 || await page.getByTestId('ide-pin-planner-xdc-removed').count() < 1) fail('exact XDC diff missing');
    await page.screenshot({ path: path.join(out, `conflict-board-${width}x${height}.png`) });
    await page.getByTestId(`ide-pin-planner-resolve-${a.pin}`).click();
    if (!(await page.getByTestId('ide-pin-planner-conflict-count').innerText()).includes('0 conflicts')) fail('conflict repair failed');
    await page.getByTestId('ide-hw-use-recommended').click();
    await assertPin(page, b.id, b.pin);
    await reference.locator(':scope > summary').click();
    await page.getByTestId(`ide-hw-xdc-select-${a.id}`).click();
    if (await page.getByTestId(`ide-hw-map-row-${a.id}`).getAttribute('aria-selected') !== 'true') fail('constraint reference did not select its port');
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(850);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('mode-button-hardware').click();
    await assertPin(page, a.id, a.pin);
    await assertPin(page, b.id, b.pin);
    if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
    results.push({ width, height, geometry, errors, status: 'pass' });
    console.log(`[${width}x${height}] PASS: selected mapping, direct board, keyboard, saved XDC, undo, conflicts/repair, constraint reference, reload`);
    await context.close();
  }
  writeFileSync(path.join(out, 'result.json'), JSON.stringify({ url: BASE_URL, proof: 'seeded integration; mapping through UI', results }, null, 2));
} finally { await browser.close(); }
