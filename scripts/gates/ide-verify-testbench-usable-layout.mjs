#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, ensureVerifyVectorsReady, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { assertVisibleRect, assertNoRootOverflow, captureBrowserProblems } from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE Verify pre-run testbench owns usable layout', async ({ page, baseUrl }) => {
  const problems = captureBrowserProblems(page);
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl + '/?mode=project&e2e=1');
    await page.getByTestId('ide-mode-project').waitFor();
    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.getByTestId('mode-button-verify').click();
    await page.getByTestId('ide-vcb-run').waitFor();
    await ensureVerifyVectorsReady(page);
    assert(/Scenario ready/i.test(await page.getByTestId('ide-verify-summary-status').textContent()), 'First-run state must identify a ready authored scenario');
    assert(await page.getByTestId('ide-vcb-run').count() === 1, 'One execution authority must own the pre-run experiment');
    await assertVisibleRect(page, ['[data-testid="ide-vcb-run"]'], 'Run', { maxTop: 200, minWidth: 48, minHeight: 24 });
    await page.getByTestId('ide-vcb-run').click({ trial: true });
    const table = page.getByTestId('ide-case-lab-table');
    await assertVisibleRect(page, ['[data-testid="ide-case-lab-table"]'], 'Authored stimulus and optional checks', { maxTop: 340, minWidth: 720, minHeight: 144 });
    const rows = table.locator('[data-testid^="ide-case-lab-row-"]');
    assert(await rows.count() === 4, 'Logic Gates must retain all four authored cases');
    const expected = table.locator('[data-testid^="ide-case-lab-exp-"]');
    const inputs = table.locator('[data-testid^="ide-case-lab-input-"]');
    assert(await expected.count() === 12, 'All twelve optional output checks must be directly editable');
    assert(await inputs.count() === 8, 'All eight input values must be directly editable');
    for (const control of [...await inputs.all(), ...await expected.all()]) {
      const box = await control.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height, 'Starter authoring controls must fit in the first viewport');
      await control.click({ trial: true });
    }
    const overflow = await table.evaluate(el => el.scrollWidth - el.clientWidth);
    assert(overflow <= 1, 'Starter cases must not require horizontal mini-scrolling');
    assert(await page.getByTestId('ide-run-identity').count() === 0, 'A ready scenario must not invent recorded execution evidence');
    await assertNoRootOverflow(page, 'Pre-run testbench');
    if (process.env.RB_VERIFY_TESTBENCH_LAYOUT_SCREENSHOTS_DIR) {
      const root = path.resolve(process.env.RB_VERIFY_TESTBENCH_LAYOUT_SCREENSHOTS_DIR);
      await fs.mkdir(root, { recursive: true });
      await page.screenshot({ path: path.join(root, 'verify-testbench-layout-prerun-' + viewport.width + 'x' + viewport.height + '.png') });
    }
  }
  assert(problems.length === 0, 'Pre-run browser errors: ' + JSON.stringify(problems));
});
