// The Design workspace holds still under the student's pointer. Wiring a small design with the
// inspector open (a part selected) at the two classroom laptop sizes, no target pin may move
// between the two clicks of a wire, and none may move from one wire to the next: in rc.7 the
// command row took a second row whenever a wire was armed, moving the canvas 44px each time.
// A refusal too long for the status line is still read in full, through More. Part names on the
// sheet stay legible in the dark workbench (they were near-white on the light sheet).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';

const out = evidenceDir('design-workspace-stability', process.env.RB_SHOT_LABEL ?? 'current');
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const results = [];

async function blankWithParts(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Blank project', exact: true }).click();
  const canvas = page.getByTestId('ide-design-canvas');
  await canvas.waitFor();
  const place = async (label, x, y) => {
    const count = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length);
    await page.getByText(label, { exact: true }).first().click();
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + x, box.y + y);
    await page.waitForFunction((n) => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length > n, count);
  };
  await place('Input Pin', 160, 180);
  await place('Input Pin', 160, 380);
  await place('AND Gate', 460, 280);
  await place('Output Pin', 760, 280);
  await page.keyboard.press('Escape');
  const nodes = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.map((n) => ({ id: n.id, type: n.type })));
  const [a, b] = nodes.filter((n) => n.type === 'INPUT');
  return { a: a.id, b: b.id, and: nodes.find((n) => n.type === 'AND').id, y: nodes.find((n) => n.type === 'OUTPUT').id };
}

try {
  // 1. Wiring with the inspector open: every target stays where the student is aiming.
  for (const [width, height] of [[1440, 900], [1366, 768]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const ids = await blankWithParts(page);
    const pin = (id, port) => page.locator(`[data-node-id="${id}"] [data-port-id="${port}"]`).first();
    const y = async (id, port) => Math.round((await pin(id, port).boundingBox()).y);
    await page.locator(`[data-node-id="${ids.y}"]`).first().click();
    assert.ok(await page.getByTestId('ide-right-dock').isVisible(), `${width}x${height}: a selected part opens the inspector`);
    const rowHeight = async () => Math.round((await page.getByTestId('ide-design-control-bar').boundingBox()).height);
    const row = await rowHeight();
    const before = await y(ids.and, 'b');
    await page.getByRole('button', { name: /^Wire$/ }).first().click();
    assert.equal(await y(ids.and, 'b'), before, `${width}x${height}: choosing Wire moves no pin`);
    for (const [from, fp, to, tp] of [[ids.a, 'out', ids.and, 'a'], [ids.b, 'out', ids.and, 'b'], [ids.and, 'out', ids.y, 'in']]) {
      const aimed = await y(to, tp);
      await pin(from, fp).click();
      await page.getByTestId('ide-design-wire-cancel').waitFor();
      assert.equal(await y(to, tp), aimed, `${width}x${height}: arming ${fp} moved the target ${tp} (${aimed} -> ${await y(to, tp)})`);
      await pin(to, tp).click();
      await page.waitForFunction(([f, t]) => window.__RB_PROJECT_RUNTIME__.getState().circuit.connections.some((c) => c.from.nodeId === f && c.to.nodeId === t), [from, to]);
      assert.equal(await y(ids.and, 'b'), before, `${width}x${height}: finishing a wire moved the canvas`);
      assert.equal(await rowHeight(), row, `${width}x${height}: the command row kept its height`);
    }
    assert.equal(await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.connections.length), 3);
    results.push({ check: 'wiring holds still', viewport: `${width}x${height}`, pinY: before, rowHeight: row });
    console.log(`ok ${width}x${height}: three wires with the inspector open, no pin or row moved`);
    await context.close();
  }

  // 2. A refusal too long for a short window's status line is read in full through More.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const ids = await blankWithParts(page);
    await page.setViewportSize({ width: 720, height: 450 }); // the student narrows the window
    await page.getByTestId('ide-design-fit-circuit-canvas').click(); // and frames the circuit again
    const pin = (id, port) => page.locator(`[data-node-id="${id}"] [data-port-id="${port}"]`).first();
    await page.getByRole('button', { name: /^Wire$/ }).first().click();
    await pin(ids.a, 'out').click();
    await pin(ids.b, 'out').click(); // an output as the target of an output: the longest refusal
    await page.getByTestId('ide-design-wire-feedback').waitFor();
    const read = () => page.evaluate(() => {
      const message = document.querySelector('[data-testid="ide-design-wire-cue"]');
      return { text: message.textContent.trim(), fits: message.scrollHeight <= message.clientHeight + 1 && message.scrollWidth <= message.clientWidth + 1, height: message.clientHeight };
    });
    let message = await read();
    assert.match(message.text, /Outputs cannot be wired directly/);
    const more = page.getByTestId('ide-design-wire-more');
    if (!message.fits) {
      assert.ok(await more.isVisible(), `720x450: a cut refusal offers More (${JSON.stringify(message)})`);
      await more.click();
      message = await read();
    }
    assert.ok(message.fits, `720x450: the whole refusal is shown after More: ${JSON.stringify(message)}`);
    await page.screenshot({ path: path.join(out, 'refusal-720x450.png') });
    results.push({ check: 'refusal read in full', viewport: '720x450', usedMore: await more.count() > 0 });
    console.log(`ok 720x450: the longest refusal is read in full${await more.count() ? ' (through More)' : ''}`);
    await context.close();
  }

  // 3. Part names on the sheet are legible in the dark workbench.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    // A shipped design whose gates carry names (XOR0, RST0, ...), opened from Starters.
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Starters/ }).first().click();
    await page.getByText('2-Bit Up Counter (Basys3)', { exact: true }).first().click();
    await page.getByRole('button', { name: /^(Open starter|Start .+)$/ }).first().click();
    await page.waitForFunction(() => (window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length ?? 0) > 0);
    await page.getByTestId('mode-button-design').click();
    await page.getByTestId('ide-design-canvas').waitFor();
    await page.keyboard.press('Control+k');
    await page.getByTestId('ide-command-palette-query').fill('Workbench dark');
    await page.getByTestId('ide-command-theme.dark').click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-rb-theme') === 'dark');
    const contrast = await page.evaluate(() => {
      const ink = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgb = (color) => { ink.clearRect(0, 0, 1, 1); ink.fillStyle = color; ink.fillRect(0, 0, 1, 1); return [...ink.getImageData(0, 0, 1, 1).data.slice(0, 3)]; };
      const lum = (c) => c.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const svg = document.querySelector('[data-testid="ide-design-canvas"] svg.rb-logic-canvas-svg');
      let background = getComputedStyle(svg).backgroundColor;
      for (let n = svg; n && /rgba\(0, 0, 0, 0\)|transparent/.test(background); n = n.parentElement) background = getComputedStyle(n).backgroundColor;
      const back = lum(rgb(background));
      return [...svg.querySelectorAll('text.rb-sym-title')].map((t) => {
        const fore = lum(rgb(getComputedStyle(t).fill));
        return { text: t.textContent.trim(), ratio: Math.round(((Math.max(fore, back) + 0.05) / (Math.min(fore, back) + 0.05)) * 100) / 100 };
      });
    });
    assert.ok(contrast.some((entry) => entry.text === 'XOR0'), `dark: the gate names are on the sheet (${contrast.map((entry) => entry.text).join(', ')})`);
    const faint = contrast.filter((entry) => entry.ratio < 4.5);
    await page.screenshot({ path: path.join(out, 'dark-design.png') });
    assert.deepEqual(faint, [], `dark: part names below 4.5:1 on the sheet: ${JSON.stringify(faint)}`);
    results.push({ check: 'dark sheet legible', names: contrast.length, lowest: Math.min(...contrast.map((entry) => entry.ratio)) });
    console.log(`ok dark: ${contrast.length} part names legible (lowest ${Math.min(...contrast.map((entry) => entry.ratio))}:1)`);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`PASS — Design workspace stability: wiring holds still, refusals read in full, the dark sheet is legible -> ${out}`);
