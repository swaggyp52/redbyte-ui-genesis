#!/usr/bin/env node
import { assert, runIdeGate, loadStarterProject, clickVerifyRun, setVerifyRunMode } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function mutateDesignCircuit(page) {
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });

  const baselineNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(baselineNodeCount >= 0, 'baseline node count unavailable for project-health mutation');

  const candidates = [
    page.locator('[data-testid="ide-design-palette-input"]').first(),
    page.locator('[data-testid="ide-design-palette-and"]').first(),
  ];

  let activated = false;
  for (const button of candidates) {
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    activated = await page
      .waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
        return canvas?.getAttribute('data-placement-active') === '1';
      }, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (activated) break;
  }

  assert(activated, 'no canonical design mutation control activated placement mode');

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'design canvas bounds unavailable for mutation placement');
  const clickPoints = [
    [0.25, 0.45],
    [0.35, 0.55],
    [0.5, 0.5],
    [0.65, 0.4],
  ];

  let mutated = false;
  for (const [xFactor, yFactor] of clickPoints) {
    await page.mouse.click(bounds.x + bounds.width * xFactor, bounds.y + bounds.height * yFactor);
    mutated = await page
      .waitForFunction(
        (expectedCount) => {
          const store = window.__RB_CIRCUIT_STORE__;
          const canvasEl = document.querySelector('[data-testid="ide-design-live-canvas"]');
          if (!store?.getState || !canvasEl) return false;
          return (
            (store.getState().circuit?.nodes?.length ?? -1) >= expectedCount &&
            canvasEl.getAttribute('data-placement-active') === '0'
          );
        },
        baselineNodeCount + 1,
        { timeout: 2500 }
      )
      .then(() => true)
      .catch(() => false);
    if (mutated) break;
  }

  assert(mutated, 'design mutation did not materialize a new node');
}


// Project reads the same recorded result and marks it stale after a real Design edit.
// Continuation follows the last working surface; it is not a verification checklist.
await runIdeGate('IDE project health live contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  await page.goto(baseUrl + '/?mode=project&e2e=1');
  await page.getByTestId('ide-project-landing').waitFor();
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.getByTestId('mode-button-project').click();
  const simulation = page.getByTestId('ide-project-fact-simulation');
  assert(/not run/i.test(await simulation.innerText()), 'A fresh project must not invent a recording');
  assert(/design/i.test(await page.getByTestId('ide-project-continue').innerText()), 'Continuation must return to the working Design surface');

  await page.getByTestId('mode-button-verify').click();
  await page.getByTestId('ide-vcb-run').waitFor();
  assert(await setVerifyRunMode(page, 'compare'), 'The starter must have authored checks for this run');
  await clickVerifyRun(page);
  await waitForVerifyResult(page);
  const recorded = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    return state.verifyRunArchive.find(run => run.runId === state.verifyLastRun?.runId);
  });
  assert(recorded?.runId && recorded.assertionStatus === 'passing' && recorded.report?.status === 'pass' && recorded.report.rows.length > 0,
    'The checked run must retain a passing report with rows and a run identity');
  await page.getByTestId('mode-button-project').click();
  await page.waitForFunction(() => /current.*pass/i.test(document.querySelector('[data-testid="ide-project-fact-simulation"]')?.textContent ?? ''));
  assert(/simulation/i.test(await page.getByTestId('ide-project-continue').innerText()), 'Continuation must resume the simulation just used');
  await page.getByTestId('ide-project-details').locator('summary').click();
  const hash = (await page.getByTestId('ide-project-fact-hash').innerText()).replace('Determinism hash', '').trim();
  assert(/^[a-f0-9]{8,16}$/i.test(hash), 'Project details must expose the current design digest: ' + hash);

  await page.getByTestId('mode-button-design').click();
  await mutateDesignCircuit(page);
  await page.getByTestId('mode-button-project').click();
  await page.waitForFunction(() => /stale/i.test(document.querySelector('[data-testid="ide-project-fact-simulation"]')?.textContent ?? ''));
  const retained = await page.evaluate((runId) => window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(run => run.runId === runId), recorded.runId);
  assert(JSON.stringify(retained) === JSON.stringify(recorded), 'Editing Design must retain the exact prior recording: ' + JSON.stringify({ present: Boolean(retained), changed: Object.keys(recorded).filter(key => JSON.stringify(recorded[key]) !== JSON.stringify(retained?.[key])) }));
  const details = page.getByTestId('ide-project-details');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  assert((await page.getByTestId('ide-project-hash-short').innerText()).trim() !== hash,
    'A real circuit edit must change the current design digest while retaining the recording');
  assert(/design/i.test(await page.getByTestId('ide-project-continue').innerText()), 'After editing, continuation must return to Design');
  console.log('Fresh -> checked PASS -> real Design edit -> stale, with exact recording retained');
});
