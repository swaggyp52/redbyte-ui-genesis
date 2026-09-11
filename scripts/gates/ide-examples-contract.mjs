#!/usr/bin/env node

// The starter library and the guarded open, through the current interface.
//
// What this gate protects:
//   1. A first visit lands on Start, and Start offers a starter library with at least three
//      starters to read about before opening one.
//   2. Selecting a starter is reading, not applying - the workspace stays empty.
//   3. Opening one is a deliberate act that lands on the sheet holding that starter's circuit.
//   4. With a project open, Project shows that project's Overview naming the starter it came
//      from - not the catalogue.
//   5. The library stays reachable from an open project (File -> Open Starter...), and opening a
//      different starter from there is guarded: unsaved work is asked about before it is replaced,
//      and a project that had been saved survives in the saved index either way.
//   6. After the switch the workspace holds the second starter, the Overview names it, and the
//      library marks it as the one that is open.
//
// It used to look for the professional overview, the engineering-record disclosure and the
// examples disclosure, which were retired with the Start Center. Those were how the product was
// drawn, not what it promised; the promise is the list above.

import { assert, runIdeGate } from './_gateHarness.mjs';

const tid = (id) => `[data-testid="${id}"]`;

async function runtimeState(page) {
  return page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__;
    const st = runtime && typeof runtime.getState === 'function' ? runtime.getState() : null;
    if (!st) return null;
    return {
      projectId: st.projectId ?? null,
      projectName: st.projectName ?? null,
      activeExampleId: st.activeExampleId ?? null,
      nodes: Array.isArray(st.circuit?.nodes) ? st.circuit.nodes.length : 0,
    };
  });
}

async function savedProjectIds(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('rb.ide.projects.v1.index');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map((entry) => entry.projectId) : [];
    } catch {
      return [];
    }
  });
}

async function openProjectOverview(page) {
  await page.locator(tid('mode-button-project')).click();
  await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 10000 });
}

async function openStarterLibraryFromFileMenu(page) {
  await page.locator(tid('ide-menu-file')).click();
  const item = page.locator(tid('ide-menu-item-project.open-starter')).first();
  await item.waitFor({ state: 'visible', timeout: 5000 });
  await item.click();
  const picker = page.locator(tid('ide-project-starter-picker')).first();
  await picker.waitFor({ state: 'visible', timeout: 10000 });
  const browser = page.locator(tid('ide-project-examples-browser')).first();
  if ((await browser.getAttribute('data-expanded')) === 'false') {
    await page.locator(tid('ide-projectx-examples-toggle')).first().click();
  }
  await page.waitForSelector('[data-testid^="ide-projectx-example-"][data-example-id]', { timeout: 10000 });
  return picker;
}

await runIdeGate('Starter library and guarded open contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector(tid('ide-root'), { timeout: 15000 });
  await page.waitForSelector(tid('ide-mode-project'), { timeout: 10000 });

  // 1. Start, with a library to read.
  await page.waitForSelector(tid('ide-project-landing'), { timeout: 10000 });
  await page.locator(tid('ide-project-open-starter-primary')).click();
  await page.waitForSelector(tid('ide-project-start-list-starters'), { timeout: 10000 });
  const starterRows = page.locator(
    '[data-testid^="ide-project-landing-example-"], [data-testid^="ide-project-lab-card-"]'
  );
  const starterCount = await starterRows.count();
  assert(starterCount >= 3, `expected >=3 starters in the library, found ${starterCount}`);

  // 2. Reading is not applying.
  const beforeBrowse = await runtimeState(page);
  assert(beforeBrowse, 'the project runtime is not exposed to the gate');
  await starterRows.nth(1).click();
  const preview = page.locator(tid('ide-project-start-preview')).first();
  await preview.waitFor({ state: 'visible', timeout: 5000 });
  const firstTitle = ((await preview.locator('.rb-start-preview-title').first().textContent()) ?? '').trim();
  assert(firstTitle.length > 0, 'the selected starter has no visible name in its preview');
  const browsed = await runtimeState(page);
  assert(
    browsed.nodes === 0 && browsed.projectId === beforeBrowse.projectId,
    `selecting a starter changed the workspace (${beforeBrowse.projectId}/${beforeBrowse.nodes} -> ${browsed.projectId}/${browsed.nodes} parts)`
  );
  assert(await page.locator(tid('ide-project-landing')).isVisible(), 'selecting a starter left Start');

  // 3. Opening is deliberate and lands on the sheet.
  const openStarter = preview.locator('[data-testid^="ide-project-start-open-"]').first();
  await openStarter.waitFor({ state: 'visible', timeout: 5000 });
  await openStarter.click();
  await page.waitForSelector(tid('ide-mode-design'), { timeout: 10000 });
  await page.waitForSelector('[data-node-id]', { timeout: 10000 });
  const first = await runtimeState(page);
  assert(first.nodes > 0, `"${firstTitle}" opened a project with no parts`);
  assert(first.activeExampleId, `"${firstTitle}" opened without an example identity`);

  // 4. Project shows the open project, naming its starter.
  await openProjectOverview(page);
  assert(!(await page.locator(tid('ide-project-landing')).isVisible().catch(() => false)),
    'with a project open, Project showed the catalogue instead of the project');
  const overviewStarter = ((await page.locator(tid('ide-project-starter-name')).first().textContent()) ?? '').trim();
  assert(overviewStarter === firstTitle,
    `the Overview names starter "${overviewStarter}" but "${firstTitle}" was opened`);

  // Give autosave its moment so the saved index reflects the first project.
  await page.waitForTimeout(1500);
  const savedBeforeSwitch = await savedProjectIds(page);
  const firstWasSaved = savedBeforeSwitch.includes(first.projectId);

  // 5. The library is reachable from an open project, and the switch is guarded.
  const picker = await openStarterLibraryFromFileMenu(page);
  const cards = picker.locator('[data-testid^="ide-projectx-example-"][data-example-id]');
  const cardCount = await cards.count();
  let targetId = '';
  let targetName = '';
  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    const candidate = ((await card.getAttribute('data-example-id')) ?? '').trim();
    if (candidate && candidate !== first.activeExampleId) {
      targetId = candidate;
      targetName = ((await card.locator('.ide-projectx-example-card-title').first().textContent()) ?? '').trim();
      break;
    }
  }
  assert(targetId.length > 0, `the library offers no second starter to switch to (${cardCount} cards)`);
  assert(targetName.length > 0, `starter ${targetId} has no visible name in the library`);
  await picker.locator(tid(`ide-project-landing-example-${targetId}`)).first().click();

  const confirmModal = page.locator(tid('ide-example-confirm-modal')).first();
  if (await confirmModal.isVisible({ timeout: 2500 }).catch(() => false)) {
    const modalText = ((await confirmModal.innerText()) ?? '').replace(/\s+/g, ' ');
    assert(modalText.includes(targetName), `the replacement guard does not name "${targetName}": "${modalText}"`);
    assert(/replaces the current workspace/i.test(modalText), `the replacement guard does not say what it replaces: "${modalText}"`);
    assert(await page.locator(tid('ide-example-cancel')).first().isVisible(), 'the replacement guard offers no way to keep the current project');
    await page.locator(tid('ide-example-confirm')).first().click();
    await confirmModal.waitFor({ state: 'hidden', timeout: 5000 });
  } else {
    // No guard means nothing unsaved: the first project must already be in the saved index.
    assert(firstWasSaved,
      `opening "${targetName}" replaced "${first.projectName}" without asking, and that project had not been saved`);
  }
  await page.locator(tid('ide-project-starter-picker-modal')).first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);

  // 6. The second starter is open now, and the first project was not lost.
  await page.waitForFunction(
    (expected) => {
      const runtime = window.__RB_PROJECT_RUNTIME__;
      const st = runtime && typeof runtime.getState === 'function' ? runtime.getState() : null;
      return Boolean(st && st.activeExampleId === expected && Array.isArray(st.circuit?.nodes) && st.circuit.nodes.length > 0);
    },
    targetId,
    { timeout: 10000 }
  );
  const second = await runtimeState(page);
  assert(second.activeExampleId === targetId, `expected starter ${targetId} to be open, found ${second.activeExampleId}`);
  await openProjectOverview(page);
  const overviewSecond = ((await page.locator(tid('ide-project-starter-name')).first().textContent()) ?? '').trim();
  assert(overviewSecond === targetName,
    `after the switch the Overview names "${overviewSecond}" but "${targetName}" was opened`);
  if (firstWasSaved) {
    const savedAfterSwitch = await savedProjectIds(page);
    assert(savedAfterSwitch.includes(first.projectId),
      `switching starters dropped the saved project ${first.projectId} from the index: ${JSON.stringify(savedAfterSwitch)}`);
  }

  const pickerAgain = await openStarterLibraryFromFileMenu(page);
  const activeCard = pickerAgain.locator(tid(`ide-projectx-example-${targetId}`)).first();
  const activeClass = (await activeCard.getAttribute('class')) ?? '';
  assert(activeClass.includes('is-active'), `the library does not mark the open starter as open (class "${activeClass}")`);
  await page.locator(tid('ide-project-starter-picker-close')).first().click();
  await page.locator(tid('ide-project-starter-picker-modal')).first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
});
