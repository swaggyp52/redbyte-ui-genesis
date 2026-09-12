// Authoring/exploration and panel ownership, through visible controls.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = evidenceDir('studio-coherence', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 650 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const tid = id => page.getByTestId(id);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await tid('ide-project-start-a-lab-primary').click();
    await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
    await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
    await tid('mode-button-design').click();
    await tid('ide-design-toolbar').waitFor();
    const tabGeometry = await page.getByRole('tablist', { name: 'Design tools' }).evaluate(strip => {
      const parent = strip.getBoundingClientRect();
      return [...strip.querySelectorAll('[role="tab"]')].map(tab => {
        const box = tab.getBoundingClientRect();
        return { label: tab.textContent, contained: box.left >= parent.left - 1 && box.right <= parent.right + 1 };
      });
    });
    await page.screenshot({ path: path.join(out, `design-normal-${viewport.width}x${viewport.height}.png`) });
    assert.ok(tabGeometry.every(tab => tab.contained), `Every Design tool is offered inside its strip: ${JSON.stringify(tabGeometry)}`);
    assert.equal(await tid('ide-design-learning-mode-replay').count(), 0, 'A recording is opened from its experiment, never a peer authoring mode');
    await tid('ide-design-explore').click();
    assert.match(await tid('ide-design-live-note').innerText(), /not recorded/i);
    await tid('ide-design-live-step').click();
    assert.match(await tid('ide-design-live-tick').innerText(), /1 clock edge applied/);
    await tid('ide-design-live-reset').click();
    assert.match(await tid('ide-design-live-tick').innerText(), /0 clock edges applied/);
    assert.equal(await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.length), 0, 'Exploration creates no recording');
    await tid('ide-design-explore').click();
    await tid('ide-design-test-design').click();
    await tid('ide-vcb-run').waitFor();
    assert.equal(await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.length), 0, 'Test this design hands off without running');
    assert.equal(await tid('ide-status-run').count(), 0, 'Run-specific state lives in the experiment');
    await tid('mode-button-design').click();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await page.screenshot({ path: path.join(out, `design-split-${viewport.width}x${viewport.height}.png`) });
    assert.equal(await tid('ide-mode-design').getAttribute('data-left-dock-state'), 'hidden', 'Split gives its primary objects the library width');
    assert.equal(await tid('ide-mode-design').getAttribute('data-right-dock-state'), 'hidden', 'Split keeps optional detail recoverable');
    assert.deepEqual(errors, []);
    results.push({ viewport, tabGeometry, errors });
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
  console.log(`PASS studio coherence: ${results.length} viewports; ${out}`);
} finally {
  await browser.close();
}
