// A module instance opens on a real double-click (owner acceptance of rc.8, V9). Pressing on a part
// captures the pointer to the sheet for dragging, so the double-click landed on the sheet and the
// instance never opened; only the inspector's Open action reached the definition.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';

const out = evidenceDir('module-open', process.env.RB_SHOT_LABEL ?? 'current');
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Starters/ }).first().click();
  await page.getByText('4-Bit Adder (hierarchical)', { exact: true }).first().click();
  await page.getByRole('button', { name: /^(Open starter|Start .+)$/ }).first().click();
  await page.waitForFunction(() => (window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length ?? 0) > 0);
  await page.getByTestId('mode-button-design').click();
  await page.getByTestId('ide-design-canvas').waitFor();
  await page.getByTestId('ide-design-fit-circuit-canvas').click();
  const active = () => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().hierarchy?.activeModuleId);
  assert.equal(await active(), 'top');
  // The student double-clicks the instance where it is drawn.
  const box = await page.locator('[data-node-id="u-fa1"]').first().boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().hierarchy?.activeModuleId !== 'top', null, { timeout: 5000 })
    .catch(() => {});
  const crumb = (await page.getByTestId('ide-design-module-breadcrumb').innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: path.join(out, 'inside-u_fa1.png') });
  assert.equal(await active(), 'module-fulladdercell', `a double-click on u_fa1 did not open its module (breadcrumb: ${crumb})`);
  assert.match(crumb, /u_fa1/);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ opened: true, breadcrumb: crumb }, null, 2));
  console.log(`ok: a double-click on u_fa1 opens its module (${crumb})`);
} finally {
  await browser.close();
}
console.log(`PASS — module instances open on a double-click -> ${out}`);
