#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, assertBuildFreshReplacementModal, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash, assertNoRootOverflow, assertVisibleRect, captureBrowserProblems } from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE Project loaded paths own first viewport', async ({ page, baseUrl }) => {
  const problems = captureBrowserProblems(page);
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl + '/?mode=project&e2e=1');
    await page.getByTestId('ide-mode-project').waitFor();
    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.getByTestId('mode-button-project').click();
    await page.getByTestId('ide-project-overview-document').waitFor();
    await assertBuildHash(page, 'Loaded Project paths');
    await assertVisibleRect(page, ['[data-testid="ide-project-continue"]'], 'Loaded continuation', { maxTop: 150, minWidth: 110, minHeight: 24 });
    await assertVisibleRect(page, ['[data-testid="ide-project-circuit-preview"]'], 'Loaded circuit context', { maxTop: 240, minWidth: 320, minHeight: 140 });
    assert(await page.getByTestId('ide-project-continue').count() === 1, 'Loaded Project must retain a single continuation');
    const title = await page.getByTestId('ide-project-overview-title').innerText();
    const projectBefore = await readWorkingProject(page);
    await page.getByTestId('ide-menu-file').click();
    for (const command of ['project.build-fresh', 'project.open-starter', 'surface.import-recover.open', 'project.open']) {
      const action = page.getByTestId('ide-menu-item-' + command);
      const box = await action.boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= viewport.height, 'File action must fit the first viewport: ' + command);
      await action.click({ trial: true });
    }
    await page.getByTestId('ide-menu-item-surface.import-recover.open').click();
    await page.getByTestId('ide-mode-import').waitFor();
    await page.getByTestId('mode-button-project').click();
    assert(await page.getByTestId('ide-project-overview-title').innerText() === title, 'Import navigation must preserve project identity');
    await page.getByTestId('ide-menu-file').click();
    await page.getByTestId('ide-menu-item-project.open-starter').click();
    const picker = page.getByTestId('ide-project-starter-picker');
    await picker.waitFor();
    assert(await visible(picker.getByTestId('ide-project-load-start-half-adder')), 'Starter picker must retain alternate projects');
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'hidden' });
    assert(await page.getByTestId('ide-project-overview-title').innerText() === title, 'Browsing and closing starters must preserve project identity');
    assert(await readWorkingProject(page) === projectBefore, 'Starter browsing must preserve the current circuit and mapping');
    await page.getByTestId('ide-menu-file').click();
    await page.getByTestId('ide-menu-item-project.build-fresh').click();
    await assertBuildFreshReplacementModal(page, 'Loaded Project blank replacement');
    assert(await page.getByTestId('ide-project-overview-title').innerText() === title, 'Cancel blank replacement must preserve current project');
    assert(await readWorkingProject(page) === projectBefore, 'Cancel blank replacement must preserve the current circuit and mapping');
    await assertNoRootOverflow(page, 'Loaded Project paths');
    if (process.env.RB_PROJECT_LOADED_PATHS_SCREENSHOTS_DIR) {
      const root = path.resolve(process.env.RB_PROJECT_LOADED_PATHS_SCREENSHOTS_DIR);
      await fs.mkdir(root, { recursive: true });
      await page.screenshot({ path: path.join(root, 'loaded-project-paths-' + viewport.width + 'x' + viewport.height + '.png') });
    }
  }
  const projectBeforeNarrow = await readWorkingProject(page);
  await page.setViewportSize({ width: 711, height: 402 });
  const restoreExplorer = page.getByTestId('ide-show-left-dock');
  await restoreExplorer.waitFor();
  await restoreExplorer.press('Enter');
  await page.getByTestId('ide-project-explorer').waitFor();
  const sources = page.getByTestId('ide-project-row-doc:sources');
  await sources.click({ trial: true });
  await sources.press('Enter');
  await page.getByTestId('ide-project-sources-document').waitFor();
  await page.keyboard.press('Escape');
  await page.getByTestId('ide-left-dock').waitFor({ state: 'hidden' });
  // Closing the panel restores focus on the next animation frame, after React
  // mounts the restore control. Assert completion, not the intermediate frame.
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'ide-show-left-dock',
    undefined, { timeout: 3000 });
  assert(await restoreExplorer.evaluate((element) => element === document.activeElement),
    'Escape from the narrow Project explorer must return focus to its existing restore control');
  await restoreExplorer.click();
  await page.getByTestId('ide-project-row-doc:overview').click();
  await page.getByTestId('ide-hide-left-dock').click();
  await page.getByTestId('ide-project-overview-document').waitFor();
  assert(await readWorkingProject(page) === projectBeforeNarrow,
    'Narrow Project document navigation must preserve the circuit and mapping');
  await assertNoRootOverflow(page, 'Narrow Project explorer recovery');
  assert(problems.length === 0, 'Loaded Project browser errors: ' + JSON.stringify(problems));
});

async function readWorkingProject(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    if (!state?.projectId || !state.circuit) throw new Error('Project authority is unavailable');
    return JSON.stringify({ id: state.projectId, circuit: state.circuit, mapping: state.ioMapping });
  });
}
