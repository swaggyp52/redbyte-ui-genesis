// Enlarged text in small windows (owner acceptance of rc.8, V10 and RB-DEBT-031). At 720x450 with
// 150% text the Start page's preview had collapsed to 0 px and the status line covered Open
// starter, so a pointer could not open a starter. At 1280x650 and 1024x640 with 150% text an armed
// wire grew the status line from 48 to 53px. Every click here is a pointer click at what is drawn.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';

const out = evidenceDir('narrow-layouts', process.env.RB_SHOT_LABEL ?? 'current');
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const results = [];

async function open(width, height, rootPx) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  await page.addInitScript((size) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${size}px`; }); }, rootPx);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  return { context, page };
}

try {
  // 1. Opening a starter by pointer in a small window with enlarged text.
  {
    const { context, page } = await open(720, 450, 24);
    await page.getByRole('button', { name: /^Starters/ }).first().click();
    await page.getByText('Full Adder', { exact: true }).first().click();
    const openStarter = page.getByRole('button', { name: /^(Open starter|Start .+)$/ }).first();
    // A pointer click: Playwright scrolls it into view and refuses if anything else takes the click.
    await openStarter.click({ timeout: 8000 });
    await page.waitForFunction(() => (window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length ?? 0) > 0);
    await page.screenshot({ path: path.join(out, 'starter-opened-720x450-150.png') });
    results.push({ check: 'starter opens by pointer', viewport: '720x450', text: '150%' });
    console.log('ok 720x450 at 150%: Open starter takes a pointer click');
    await context.close();
  }

  // 2. Arming a wire never changes the status line's height or moves a pin.
  for (const [width, height] of [[1280, 650], [1024, 640]]) {
    const { context, page } = await open(1440, 900, 24);
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
    await page.keyboard.press('Escape');
    const nodes = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.map((n) => ({ id: n.id, type: n.type })));
    const [a, b] = nodes.filter((n) => n.type === 'INPUT');
    const and = nodes.find((n) => n.type === 'AND');
    await page.setViewportSize({ width, height });
    await page.getByTestId('ide-design-fit-circuit-canvas').click();
    const pinAt = async (node, port) => {
      const box = await page.locator(`[data-node-id="${node.id}"] [data-port-id="${port}"]`).first().boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const lineHeight = async () => Math.round((await page.getByTestId('ide-status-bar').boundingBox()).height);
    const before = { line: await lineHeight(), target: await pinAt(and, 'b') };
    const wire = await page.getByRole('button', { name: /^Wire$/ }).first().boundingBox();
    await page.mouse.click(wire.x + wire.width / 2, wire.y + wire.height / 2);
    const source = await pinAt(a, 'out');
    await page.mouse.click(source.x, source.y);
    await page.getByTestId('ide-design-wire-cancel').waitFor();
    const armed = { line: await lineHeight(), target: await pinAt(and, 'b') };
    await page.mouse.click(armed.target.x, armed.target.y);
    await page.waitForFunction(([f, t]) => window.__RB_PROJECT_RUNTIME__.getState().circuit.connections.some((c) => c.from.nodeId === f && c.to.nodeId === t), [a.id, and.id]);
    const wired = { line: await lineHeight(), target: await pinAt(and, 'b') };
    await page.screenshot({ path: path.join(out, `armed-${width}x${height}-150.png`) });
    assert.equal(armed.line, before.line, `${width}x${height} at 150%: arming a wire changed the status line (${before.line} -> ${armed.line}px)`);
    assert.equal(wired.line, before.line, `${width}x${height} at 150%: finishing a wire changed the status line (${before.line} -> ${wired.line}px)`);
    assert.equal(Math.round(armed.target.y), Math.round(before.target.y), `${width}x${height} at 150%: arming moved the target pin`);
    assert.equal(Math.round(wired.target.y), Math.round(before.target.y), `${width}x${height} at 150%: finishing moved the target pin`);
    results.push({ check: 'wiring keeps the status line', viewport: `${width}x${height}`, text: '150%', line: before.line });
    console.log(`ok ${width}x${height} at 150%: the status line stays ${before.line}px and no pin moves while wiring`);
    void b;
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`PASS — narrow layouts with enlarged text: starters open by pointer, wiring keeps the status line -> ${out}`);
