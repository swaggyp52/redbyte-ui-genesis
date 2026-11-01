#!/usr/bin/env node

import { assert, assertBuildFreshReplacementModal, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash, assertNoRootOverflow, assertVisibleRect, captureBrowserProblems } from './_workbenchReconstructionHarness.mjs';

// Entry, continuation and replacement now belong to Start, Overview and File.
await runIdeGate('IDE project command center contract satisfied', async ({ page, baseUrl }) => {
  const problems = captureBrowserProblems(page);
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl + '/?mode=project&e2e=1&gate=project-command-center');
    if (!(await visible(page.getByTestId('ide-project-landing')))) {
      await page.getByTestId('ide-menu-file').click();
      await page.getByTestId('ide-menu-item-project.close').click();
    }
    await page.getByTestId('ide-project-landing').waitFor();
    await assertBuildHash(page, 'Project Start');
    for (const id of ['ide-project-build-fresh-primary', 'ide-project-import-primary', 'ide-project-open-existing-primary', 'ide-project-open-starter-primary']) {
      const action = page.getByTestId(id);
      await assertVisibleRect(page, ['[data-testid="' + id + '"]'], 'Start action ' + id, { minWidth: 80, minHeight: 24 });
      await action.click({ trial: true });
    }
    const startText = await page.getByTestId('ide-project-landing').innerText();
    assert(!/required basys3 i\/o mappings are missing|export stays blocked/i.test(startText), 'Start must not blame downstream mapping or package setup');
    await page.getByTestId('ide-project-open-starter-primary').click();
    const starters = page.getByTestId('ide-project-start-list-starters');
    await starters.waitFor();
    assert(await starters.getByRole('option').count() >= 4, 'Starters must provide several direct choices');
    await page.getByTestId('ide-project-landing-example-half-adder').click();
    assert(await visible(page.getByTestId('ide-project-start-preview')), 'Selecting a starter must expose its preview');
    assert(!(await visible(page.getByTestId('ide-mode-design'))), 'Browsing must not replace the project');
    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.getByTestId('mode-button-project').click();
    await page.getByTestId('ide-project-overview-document').waitFor();
    assert((await page.getByTestId('ide-project-overview-title').innerText()).includes('Logic Gates'), 'Overview must identify the loaded project');
    await assertVisibleRect(page, ['[data-testid="ide-project-circuit-preview"]'], 'Loaded project circuit', { minWidth: 320, minHeight: 140 });
    const continuation = page.getByTestId('ide-project-continue');
    assert(await visible(continuation), 'Loaded Overview must keep one direct continuation');
    assert(await continuation.count() === 1, 'Loaded Overview must expose exactly one continuation authority');
    const continuationText = await continuation.innerText();
    await continuation.click();
    const target = /simulate/i.test(continuationText) ? 'verify' : /board/i.test(continuationText) ? 'hardware' : /package/i.test(continuationText) ? 'export' : 'design';
    await page.getByTestId('ide-mode-' + target).waitFor();
    await page.getByTestId('mode-button-project').click();
    const titleBefore = await page.getByTestId('ide-project-overview-title').innerText();
    const projectBefore = await readWorkingProject(page);
    await page.getByTestId('ide-menu-file').click();
    for (const command of ['project.build-fresh', 'project.open-starter', 'surface.import-recover.open', 'project.open']) {
      assert(await visible(page.getByTestId('ide-menu-item-' + command)), 'File must retain ' + command);
    }
    await page.getByTestId('ide-menu-item-project.build-fresh').click();
    await assertBuildFreshReplacementModal(page, 'Loaded Project blank replacement');
    assert(await page.getByTestId('ide-project-overview-title').innerText() === titleBefore, 'Cancel replacement must preserve loaded project identity');
    assert(await readWorkingProject(page) === projectBefore, 'Cancel replacement must preserve the project, circuit and mapping');
    await assertNoRootOverflow(page, 'Project');
  }
  assert(problems.length === 0, 'Project browser errors: ' + JSON.stringify(problems));
});

async function readWorkingProject(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    if (!state?.projectId || !state.circuit) throw new Error('Project authority is unavailable');
    return JSON.stringify({ id: state.projectId, circuit: state.circuit, mapping: state.ioMapping });
  });
}
