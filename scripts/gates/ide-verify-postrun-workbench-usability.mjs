#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const CURRENT_SHA = process.env.RB_GATE_EXPECTED_SHA?.slice(0,7) || execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();

const VIEWPORTS = [
  {
    label: '1366x768',
    width: 1366,
    height: 768,
    compact: false,
    minStimulusWidth: 500,
    minWaveformPreviewClippedHeight: 160,
    maxWaveformPreviewTopOffset: 300,
  },
  {
    label: '1440x900',
    width: 1440,
    height: 900,
    compact: false,
    minStimulusWidth: 530,
    minWaveformPreviewClippedHeight: 290,
    maxWaveformPreviewTopOffset: 300,
  },
  {
    label: '1093x614',
    width: 1093,
    height: 614,
    compact: true,
    minStimulusWidth: 760,
    minWaveformPreviewClippedHeight: 150,
    maxWaveformPreviewTopOffset: 300,
  },
];

const SCREENSHOT_ROOT = process.env.RB_VERIFY_POSTRUN_WORKBENCH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_POSTRUN_WORKBENCH_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify post-run workbench remains usable', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: 'console.error', text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesVerify(page, baseUrl, viewport.label);
      await ensureVerifyVectorsReady(page);
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must be selectable`);

      let status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyPass(status), `${viewport.label}: initial Compare should PASS, got "${status}"`);
      await capture(page, viewport, '01-compare-pass');
      await assertPostRunWorkbench(page, viewport, 'PASS');

      await assertPostRunToggleKeepsWorkbenchAccessible(page, viewport);

      const target = await pickRenderedExpectedTarget(page);
      const wrongValue = target.value === 0 ? 1 : 0;
      await clickExpectedCellToValue(page, target, wrongValue);
      await assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must remain selectable after edit`);

      status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyFail(status), `${viewport.label}: wrong expected output should FAIL, got "${status}"`);
      await capture(page, viewport, '02-compare-fail');
      await assertPostRunWorkbench(page, viewport, 'FAIL');

      await clickExpectedCellToValue(page, target, target.value);
      await assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must remain selectable after repair`);
      status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyPass(status), `${viewport.label}: repaired expected output should PASS, got "${status}"`);
      await capture(page, viewport, '03-repair-pass');
      await assertPostRunWorkbench(page, viewport, 'REPAIR PASS');
    } catch (error) {
      await capture(page, viewport, 'failure');
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(findings.length === 0, `Verify post-run workbench emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
  assert(failures.length === 0, `Verify post-run workbench failures:\n${failures.join('\n')}`);
});

async function openLogicGatesVerify(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-postrun-workbench-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function selectRepresentation(page, name) {
  const details = page.getByTestId('ide-verify-details');
  if (await details.getAttribute('aria-pressed') === 'true') await details.click();
  await page.getByTestId('ide-verify-view-' + name).click();
  await page.waitForFunction(expected => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-representation') === expected, name);
}

// Desktop tool commands use the product's 24px pointer target floor. This check
// also requires the entire target to be unclipped and its center to accept input.
async function assertReachable(page, locator, label, {minSize = 24, scroll = true} = {}) {
  assert(await locator.isVisible(), label + ': control must be rendered');
  if (scroll) await locator.scrollIntoViewIfNeeded();
  const m = await locator.evaluate(element => {
    const r=element.getBoundingClientRect(); let l=Math.max(0,r.left),t=Math.max(0,r.top),b=Math.min(innerHeight,r.bottom),right=Math.min(innerWidth,r.right);
    for(let e=element.parentElement;e;e=e.parentElement){const s=getComputedStyle(e),a=e.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowX)){l=Math.max(l,a.left);right=Math.min(right,a.right);}if(/auto|scroll|hidden|clip/.test(s.overflowY)){t=Math.max(t,a.top);b=Math.min(b,a.bottom);}}
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    const ancestors=[];
    for(let e=element.parentElement;e;e=e.parentElement){const style=getComputedStyle(e),box=e.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowY))ancestors.push({cls:e.className,id:e.getAttribute('data-testid'),overflow:style.overflowY,height:box.height,top:box.top,bottom:box.bottom,client:e.clientHeight,scroll:e.scrollHeight,flex:style.flex,maxHeight:style.maxHeight});}
    return {width:r.width,height:r.height,visibleWidth:right-l,visibleHeight:b-t,hit:hit===element||element.contains(hit),font:parseFloat(getComputedStyle(element).fontSize),extraX:element.scrollWidth-element.clientWidth,ancestors};
  });
  assert(m.width>=minSize-.5 && m.height>=minSize-.5, label+': desktop target floor '+JSON.stringify(m));
  assert(m.font>=13, label+': routine command text must remain readable '+JSON.stringify(m));
  assert(m.visibleWidth>=m.width-2 && m.visibleHeight>=m.height-2 && m.hit, label+': entire control must remain reachable '+JSON.stringify(m));
  assert(m.extraX<=1, label+': label must not clip '+JSON.stringify(m));
}

async function assertPostRunWorkbench(page, viewport, label) {
  await selectRepresentation(page,'waveform');
  const m=await page.evaluate(()=>{
    const box=id=>{const e=document.querySelector('[data-testid="'+id+'"]');if(!e)return null;const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom};};
    const preview=document.querySelector('[data-testid="ide-verify-waveform-preview"]'); const r=preview.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
    for(let e=preview.parentElement;e;e=e.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(e).overflowY)){const b=e.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}
    const grid=document.querySelector('[data-testid="ide-verify-lab-grid"]');
    return {sha:document.querySelector('[data-testid="ide-top-bar"]')?.getAttribute('data-build-sha'),phase:grid?.getAttribute('data-verify-workflow-phase'),layout:grid?.getAttribute('data-stimulus-layout'),lab:box('ide-verify-lab-grid'),wave:box('ide-verify-region-waveform'),preview:box('ide-verify-waveform-preview'),visibleHeight:Math.max(0,bottom-top),count:document.querySelectorAll('[data-testid="ide-verify-waveform-preview"]').length,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth};
  });
  assert(m.sha===CURRENT_SHA, viewport.label+'/'+label+': served build identity '+m.sha);
  assert(m.phase==='post-run' && m.layout==='stable', label+': stable completed run layout');
  assert(m.overflow<=1, label+': no document horizontal overflow '+m.overflow);
  assert(m.wave.width>=viewport.minStimulusWidth && m.wave.width>=m.lab.width*.92, label+': waveform owns available workspace '+JSON.stringify(m));
  assert(m.count===1, label+': exactly one waveform work object');
  assert(m.visibleHeight>=viewport.minWaveformPreviewClippedHeight, viewport.label+'/'+label+': insufficient visible waveform '+JSON.stringify(m));
  assert(m.visibleHeight/m.preview.height>=.5, label+': at least half the waveform is initially visible');
  assert(m.preview.top-m.wave.top<=viewport.maxWaveformPreviewTopOffset, label+': waveform starts too low');
  for(const id of ['ide-vcb-run','ide-verify-view-table','ide-verify-view-waveform','ide-verify-details','ide-verify-zoom-all','ide-verify-zoom-fail','ide-verify-zoom-window','ide-verify-tick-scrubber']) {
    await assertReachable(page,page.getByTestId(id),viewport.label+'/'+label+'/'+id,{scroll:false});
  }
  const last=page.locator('[data-testid^="ide-verify-waveform-row-"]').last();
  assert(await last.count()===1,label+': trace lanes exist');
  await last.scrollIntoViewIfNeeded();
  const lane=await last.boundingBox();assert(lane.height>=8 && lane.y>=0 && lane.y+lane.height<=viewport.height+1,label+': final lane is reachable '+JSON.stringify(lane));
  const runBefore=await page.evaluate(()=>JSON.stringify(window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun));
  const scrubber=page.getByTestId('ide-verify-tick-scrubber');
  await scrubber.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  assert(await scrubber.inputValue()==='1',label+': keyboard scrubbing selects the next recorded case');
  const tools=page.getByTestId('ide-verify-waveform-tools');
  if(!await tools.evaluate(e=>e.open))await tools.locator('summary').click();
  for(const id of ['ide-verify-zoom-out','ide-verify-zoom-in','ide-verify-zoom-fit','ide-verify-density-small','ide-verify-density-normal','ide-verify-density-large','ide-verify-set-cursor-a','ide-verify-set-cursor-b','ide-verify-jump-cursor-a','ide-verify-jump-cursor-b','ide-verify-clear-cursors']) {
    await assertReachable(page,page.getByTestId(id),viewport.label+'/'+label+'/'+id);
  }
  await page.getByTestId('ide-verify-set-cursor-a').click();
  await scrubber.focus();await page.keyboard.press('End');
  await page.getByTestId('ide-verify-set-cursor-b').click();
  assert(/A t1/.test(await page.getByTestId('ide-verify-cursor-a-value').textContent()),label+': cursor A owns selected tick');
  assert(/B t3/.test(await page.getByTestId('ide-verify-cursor-b-value').textContent()),label+': cursor B owns selected tick');
  await page.getByTestId('ide-verify-jump-cursor-a').click();
  assert(await scrubber.inputValue()==='1',label+': jump A restores its sample');
  await page.getByTestId('ide-verify-clear-cursors').click();
  assert(await page.getByTestId('ide-verify-cursor-a-value').count()===0 && await page.getByTestId('ide-verify-cursor-b-value').count()===0,label+': clear removes both measurement cursors');
  await tools.locator('summary').click();
  assert(await page.evaluate(()=>JSON.stringify(window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun))===runBefore,label+': presentation controls preserve immutable evidence');
  if(label==='FAIL') {
    await page.getByTestId('ide-verify-details').click();
    await page.getByTestId('ide-verify-analysis-tab-nav').getByRole('button',{name:'Checks',exact:true}).click();
    const decision=page.getByTestId('ide-verify-repair-decision');await decision.scrollIntoViewIfNeeded();
    assert(/expected output wrong.*circuit wrong/i.test(await decision.textContent()),label+': diagnosis distinguishes both repair paths');
    for(const id of ['ide-verify-repair-use-observed','ide-verify-repair-open-design','ide-verify-results-summary-open-fail'])await assertReachable(page,page.getByTestId(id),viewport.label+'/'+label+'/'+id);
    await page.getByTestId('ide-verify-results-summary-open-fail').click();
    assert(await page.getByTestId('ide-verify-fail-nav-summary').isVisible(),label+': selected mismatch remains available');
    await page.getByTestId('ide-verify-details').click();
  }
  await selectRepresentation(page,'table');
  const table=await page.getByTestId('ide-case-lab').boundingBox();
  assert(table.width>=viewport.minStimulusWidth,label+': case authoring remains readable');
  assert(await page.locator('[data-testid^="ide-case-lab-exp-"]').count()>=12,label+': every saved check remains editable');
  const extra=await page.locator('.ide-case-lab-scroll').evaluate(e=>e.scrollWidth-e.clientWidth);
  assert(extra<=8,label+': case table creates no horizontal mini-scroll trap');
  await assertReachable(page,page.locator('[data-testid^="ide-case-lab-exp-"]').last(),label+'/last expected cell');
  await selectRepresentation(page,'waveform');
}

async function assertPostRunToggleKeepsWorkbenchAccessible(page, viewport) {
  assert(await page.getByTestId('ide-verify-workbench-toggle').count()===0,viewport.label+': retired collapse control remains absent');
  await page.getByTestId('ide-verify-details').click();
  assert(await page.getByTestId('ide-verify-analysis-tab-nav').isVisible(),viewport.label+': Details opens analysis');
  await page.getByTestId('ide-verify-details').click();
  assert(!await page.getByTestId('ide-verify-analysis-tab-nav').isVisible(),viewport.label+': closing Details restores work area');
  await selectRepresentation(page,'table');
  assert(await page.locator('[data-testid^="ide-case-lab-exp-"]').first().isVisible(),viewport.label+': authoring remains available after disclosure close');
}

async function clickRunAndWaitForNewResult(page) {
  const previousRunId = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.runId ?? null
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const nextRunId = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.runId ?? null;
      return Boolean(nextRunId && nextRunId !== previous);
    },
    previousRunId,
    { timeout: 20000 }
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  return ((await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '').trim();
}

async function pickRenderedExpectedTarget(page) {
  await page.locator('[data-testid="ide-verify-view-table"]').first().click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-studio-mode') === 'scenario',
    { timeout: 5000 },
  );
  const cells = await page.locator('[data-testid^="ide-case-lab-exp-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') || '';
      const title = element.getAttribute('title') || '';
      const match = /^ide-case-lab-exp-(\d+)-(.+)$/.exec(testId);
      const value = element.querySelector('code')?.textContent?.trim();
      return {
        testId,
        signal: match?.[2] ?? '',
        tick: match?.[1] ? Number(match[1]) : -1,
        value: value === '1' ? 1 : value === '0' ? 0 : null,
        title,
      };
    })
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `expected at least one rendered expected-output cell with a saved 0/1 value, saw ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function readRenderedCellValue(page, target) {
  const value = await page.getByTestId(target.testId).first().locator('code').textContent();
  return value === '1' ? 1 : value === '0' ? 0 : null;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  await page.locator('[data-testid="ide-verify-view-table"]').first().click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-studio-mode') === 'scenario',
    { timeout: 5000 },
  );
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readRenderedCellValue(page, target);
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(150);
  }
  const current = await readRenderedCellValue(page, target);
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-postrun-workbench-${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
