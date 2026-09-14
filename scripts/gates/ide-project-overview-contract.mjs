#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash, captureBrowserProblems } from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE project overview contract satisfied', async ({ page, baseUrl }) => {
  const problems = captureBrowserProblems(page);
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  await page.goto(baseUrl + '/?mode=project&e2e=1');
  await page.getByTestId('ide-project-landing').waitFor();
  await assertBuildHash(page, 'Project Overview');
  assert(await visible(page.getByRole('heading', { name: 'Course labs', exact: true })), 'Start must explain the selected starting context');
  for (const id of ['ide-project-build-fresh-primary', 'ide-project-import-primary', 'ide-project-open-existing-primary']) {
    assert(await visible(page.getByTestId(id)), 'Start must expose ' + id);
  }
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.getByTestId('mode-button-project').click();
  await page.getByTestId('ide-project-overview-document').waitFor();
  assert(/Logic Gates/.test(await page.getByTestId('ide-project-overview-title').innerText()), 'Loaded Overview must identify the project');
  assert(await visible(page.getByTestId('ide-project-circuit-preview')), 'Loaded Overview must expose real circuit context');
  assert(/5\/5.*mapped/i.test(await page.getByTestId('ide-project-fact-mapping').innerText()), 'Overview mapping summary must match the loaded five mapped signals');
  assert(await visible(page.getByTestId('ide-project-continue')), 'Loaded Overview must retain direct continuation');
  await page.getByTestId('ide-project-io-details').locator('summary').click();
  const boundary = page.getByTestId('ide-project-io-table');
  assert(await visible(boundary), 'I/O disclosure must reveal mapping summaries');
  assert(await boundary.locator('tbody tr').count() === 5, 'I/O disclosure must retain all five signals');
  assert(await boundary.locator('input, select').count() === 0, 'Overview must not introduce a second pin-editing authority');
  await page.getByTestId('ide-project-io-row-sw0').dblclick();
  await page.getByTestId('ide-mode-hardware').waitFor();
  assert(await visible(page.getByTestId('ide-hw-map-table')), 'Opening an I/O object must route to Board mapping');
  assert(problems.length === 0, 'Overview browser errors: ' + JSON.stringify(problems));
});