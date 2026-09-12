// D1–D3: the user can see and reproduce a retained execution, through actual controls.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = evidenceDir('determinism', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
let page;
try {
  page = await browser.newPage({ viewport: { width: 1280, height: 650 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const tid = id => page.getByTestId(id);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await tid('ide-project-start-a-lab-primary').click();
  await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
  await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
  await tid('mode-button-verify').click();
  await page.screenshot({ path: path.join(out, 'before-run-1280x650.png') });
  assert.equal(await tid('ide-vcb-run-intent').count(), 0, 'Run has one meaning');
  await tid('ide-vcb-run').click();
  await tid('ide-run-identity').waitFor({ timeout: 8000 });
  const original = await tid('ide-run-output-digest').getAttribute('data-digest');
  const originalRunId = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun.runId);
  assert.ok(original?.length >= 8, 'The native output digest is accessible in the DOM');
  for (let n = 0; n < 3; n++) await tid('ide-vcb-reproduce').click();
  assert.match(await tid('ide-run-repetition').innerText(), /4 runs · 4 identical/);
  await tid('ide-run-details').locator('summary').click();
  const digests = await page.locator('[data-recording-output-digest]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-recording-output-digest')));
  assert.equal(digests.length, 4);
  assert.ok(digests.every(digest => digest === original), 'All four displayed recording digests agree');
  await page.screenshot({ path: path.join(out, 'four-identical-1280x650.png') });
  await tid('ide-run-details').locator('summary').click();
  await page.screenshot({ path: path.join(out, 'recording-instrument-1280x650.png') });
  assert.equal(await tid('ide-sim-context-inspector').count(), 0, 'Details does not take width until requested');
  assert.equal(await tid('ide-verify-view-timeline').count(), 0, 'Sequential experiments have one time instrument');
  assert.equal(await tid('ide-verify-view-waveform').count(), 0, 'The recorded outputs remain on the authoring time axis');
  const inputCell = page.locator('[data-testid^="ide-timing-cell-"][data-testid$="-2"]:not([data-generated="true"])').first();
  const beforeInput = await inputCell.getAttribute('aria-label');
  await inputCell.click();
  assert.notEqual(await inputCell.getAttribute('aria-label'), beforeInput, 'The edit changes the authored stimulus');
  assert.match(await tid('ide-run-input-changes').innerText(), /Stimulus changed/);
  await tid('ide-vcb-reproduce').click();
  assert.equal(await tid('ide-run-output-digest').getAttribute('data-digest'), original, 'Reproduce ignores current draft changes');
  assert.notEqual(await inputCell.getAttribute('aria-label'), beforeInput, 'Reproduce does not overwrite the authoring draft');
  await tid('ide-vcb-run').click();
  const editedStimulusDigest = await tid('ide-run-output-digest').getAttribute('data-digest');
  assert.notEqual(editedStimulusDigest, original, 'This EN edit changes the actual counter recording');
  const stimulusRun = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun.runId);
  await tid('mode-button-design').click();
  const xorId = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find(node => node.type === 'XOR')?.id);
  assert.ok(xorId, 'The real counter has a replaceable XOR');
  await page.locator(`[data-node-id="${xorId}"]`).first().click();
  const designGeometry = await page.evaluate(() => {
    const elements = ['.ide-workbench-main', '.ide-workbench-workspace', '.ide-workbench-dock-right', '.rb-design-dock-body'];
    const result = {};
    for (const selector of elements) {
      const el = document.querySelector(selector); const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
      const rules = [];
      function scan(list) { for (const rule of list) {
        if (rule.type === CSSRule.MEDIA_RULE && !matchMedia(rule.conditionText).matches) continue;
        if (rule.cssRules) scan(rule.cssRules);
        if (rule.selectorText && el.matches(rule.selectorText) && /grid-(column|row|template)|max-height/.test(rule.style.cssText)) rules.push(rule.cssText);
      } }
      for (const sheet of document.styleSheets) { try { scan(sheet.cssRules); } catch {} }
      result[selector] = { box: {x:rect.x,y:rect.y,width:rect.width,height:rect.height}, columns:style.gridTemplateColumns,rows:style.gridTemplateRows,column:style.gridColumn,row:style.gridRow, maxHeight:style.maxHeight,rules };
    }
    return result;
  });
  fs.writeFileSync(path.join(out, 'design-layout.json'), JSON.stringify(designGeometry, null, 2));
  await tid('ide-design-swap-or').click();
  await tid('ide-design-test-design').click();
  assert.equal(await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun.runId), stimulusRun, 'Design handoff does not run');
  assert.match(await tid('ide-run-input-changes').innerText(), /Design changed.*XOR.*OR/);
  await page.screenshot({ path: path.join(out, 'design-changed-1280x650.png') });
  await tid('ide-vcb-run').click();
  const changedDesignDigest = await tid('ide-run-output-digest').getAttribute('data-digest');
  assert.notEqual(changedDesignDigest, editedStimulusDigest, 'The gate defect changes the recorded outputs');
  await page.getByLabel('Recorded run', { exact: true }).selectOption(originalRunId);
  assert.equal(await tid('ide-run-output-digest').getAttribute('data-digest'), original, 'The original evidence remains selectable');
  await tid('ide-verify-inspect-circuit').click();
  await page.getByLabel('Recorded circuit signal').selectOption('LD0');
  await tid('ide-timing-lanes').focus();
  await tid('ide-timing-lanes').press('Home');
  await tid('ide-timing-lanes').press('ArrowRight');
  await tid('ide-timing-lanes').press('ArrowRight');
  await page.screenshot({ path: path.join(out, 'linked-recording-1280x650.png') });
  const cause = tid('ide-causal-walk');
  await cause.locator('[data-causal-kind="driver"]').first().click();
  const driverContext = await tid('ide-recorded-circuit-context').innerText();
  assert.match(driverContext, /Q0|q0/);
  const capture = cause.locator('[data-causal-kind="capture"]');
  const causeText = await cause.innerText();
  if (await capture.count()) {
    await capture.first().click();
    assert.match(await tid('ide-recorded-circuit-context').innerText(), /CLK|clk/);
  } else assert.match(causeText, /No supported capturing edge/);
  await page.screenshot({ path: path.join(out, 'causal-driver-1280x650.png') });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseUrl: BASE_URL, original, digests, editedStimulusDigest, changedDesignDigest, driverContext, causeText, errors }, null, 2));
  console.log(`PASS visible determinism: ${out}`);
} catch (error) {
  console.log((await page?.locator('body').textContent())?.slice(-9000));
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally { await browser.close(); }
