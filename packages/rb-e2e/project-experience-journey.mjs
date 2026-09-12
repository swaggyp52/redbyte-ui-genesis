// Project as two experiences, driven through the real interface.
//
// Start answers "what am I going to work on?". Overview answers "what is this project, where did I
// leave it, and what deserves attention?". This journey proves the distinction is real, that it is
// decided by whether a project is open rather than by whether the circuit has parts, and that the
// paths a person actually takes - browse, open, continue, close, resume - keep their work.
//
// Every step below is a click or a keystroke. The store is read for assertions and never written.
//
// Runs at 1440x900 and at a deliberately short 1280x650, because a short window is where a
// composed page is most likely to be wrong.
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';

const OUT = evidenceDir('project-experience');
const tid = (t) => `[data-testid="${t}"]`;
const browser = await launchChromium();

const fail = (msg) => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) fail(msg); };

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)));
  const at = `[${width}×${height}]`;

  // Read-only views of the truth the UI is supposed to be presenting.
  const state = () => page.evaluate(() => {
    const st = window.__RB_PROJECT_RUNTIME__.getState();
    return {
      projectId: st.projectId ?? null,
      projectName: st.projectName ?? null,
      projectKind: st.projectKind ?? null,
      nodes: (st.circuit?.nodes ?? []).length,
      nets: (st.circuit?.connections ?? []).length,
    };
  });
  const surface = () => page.evaluate(() => ({
    start: Boolean(document.querySelector('[data-testid="ide-project-landing"]')),
    overview: Boolean(document.querySelector('[data-testid="ide-project-overview-document"]')),
  }));
  const savedIndex = () => page.evaluate(() => {
    try {
      const raw = localStorage.getItem('rb.ide.projects.v1.index');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map((e) => `${e.projectName}|${e.projectId}`) : ['<not an array>'];
    } catch { return ['<unreadable>']; }
  });
  const runCommand = async (id) => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector(tid('ide-command-palette'), { state: 'visible', timeout: 8000 });
    await page.getByTestId('ide-command-palette-query').fill(id.split('.').slice(-1)[0]);
    await page.waitForSelector(tid(`ide-command-${id}`), { state: 'visible', timeout: 8000 });
    await page.getByTestId(`ide-command-${id}`).click();
    await page.waitForTimeout(1400);
  };

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-project-landing'), { timeout: 20000 });

  // ── ① Fresh Start: nothing invented, and every way to begin is on the page ──────────────
  const fresh = await surface();
  assert(fresh.start && !fresh.overview, 'a first visit must open Start, not a project Overview');
  const freshIndex = await savedIndex();
  assert(freshIndex.length === 0,
    `a first visit invented ${freshIndex.length} recent project(s): ${JSON.stringify(freshIndex)}`);
  for (const entry of [
    ['ide-project-build-fresh-primary', 'start something blank'],
    ['ide-project-import-primary', 'import a project'],
    ['ide-project-open-existing-primary', 'open a saved project'],
    ['ide-project-start-a-lab-primary', 'start a course lab'],
  ]) {
    assert(await page.getByTestId(entry[0]).isVisible(), `Start offers no way to ${entry[1]}`);
  }
  console.log(`${at} ① fresh Start: 0 invented recents; blank / import / open saved / labs all offered`);

  // ── ② Browsing the catalogue does not apply anything ────────────────────────────────────
  const beforeBrowse = await state();
  await page.getByTestId('ide-project-start-a-lab-primary').click();
  await page.waitForTimeout(500);
  const labCards = page.locator('[data-testid^="ide-project-gannon-lab-card-"]');
  const labCount = await labCards.count();
  assert(labCount > 0, 'the labs section lists no labs');
  await labCards.nth(1).click();
  await page.waitForTimeout(500);
  const browsed = await state();
  const browsedSurface = await surface();
  const previewText = (await page.getByTestId('ide-project-start-preview').innerText()).trim();
  assert(browsedSurface.start && !browsedSurface.overview,
    'selecting a lab in the catalogue opened it - browsing must be reading, not applying');
  assert(browsed.nodes === 0 && browsed.projectId === beforeBrowse.projectId,
    `selecting a lab changed the workspace: ${beforeBrowse.projectId}/${beforeBrowse.nodes} -> ` +
    `${browsed.projectId}/${browsed.nodes} parts`);
  assert(previewText.length > 40, 'the selected lab shows no brief to decide from');
  console.log(`${at} ② browsed ${labCount} labs and read a ${previewText.length}-char brief; workspace still empty`);

  // ── ③ Opening one is a deliberate act, and it lands on that project ─────────────────────
  const startButton = page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first();
  const startLabel = (await startButton.innerText()).trim();
  await startButton.click();
  await page.waitForTimeout(2200);
  const opened = await state();
  assert(opened.nodes > 0, `"${startLabel}" opened a project with no parts`);
  await page.getByTestId('mode-button-project').click();
  await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 10000 });
  const openedSurface = await surface();
  assert(openedSurface.overview && !openedSurface.start,
    'with a project open, Project must show that project rather than the catalogue');
  console.log(`${at} ③ "${startLabel}" -> "${opened.projectName}" (${opened.nodes} parts, ${opened.nets} nets) and Project shows its Overview`);

  // ── ④ The Overview is composed: one object, one continuation, state beside it ───────────
  const composition = await page.evaluate(() => {
    const el = (id) => document.querySelector(`[data-testid="${id}"]`);
    const box = (node) => (node ? node.getBoundingClientRect() : null);
    const canvas = box(el('ide-project-design-overview')) ?? box(el('ide-project-canvas-blank'));
    const cont = el('ide-project-continue');
    const top = el('ide-project-fpga-top');
    const topBox = box(top);
    const details = Array.from(document.querySelectorAll('[data-testid="ide-project-overview-document"] details'));
    const facts = ['simulation', 'mapping', 'package'].map((id) => {
      const row = el(`ide-project-fact-${id}`);
      return row ? `${id}=${row.querySelector('dd')?.textContent.trim()}` : `${id}=<missing>`;
    });
    // Is the Top editor actually reachable by a pointer, or only present in the document?
    const topReachable = topBox && topBox.width > 0 && topBox.height > 0
      ? (() => {
          const hit = document.elementFromPoint(topBox.left + topBox.width / 2, topBox.top + topBox.height / 2);
          return Boolean(hit && (hit === top || top.contains(hit) || hit.contains(top)));
        })()
      : false;
    const doc = el('ide-project-overview-document');
    const docBox = box(doc);
    return {
      canvasHeight: canvas ? Math.round(canvas.height) : 0,
      canvasWidth: canvas ? Math.round(canvas.width) : 0,
      continuation: cont ? cont.textContent.trim() : null,
      continuationCount: document.querySelectorAll('[data-testid="ide-project-continue"]').length,
      facts,
      openDetails: details.filter((d) => d.open).map((d) => d.dataset.testid ?? '<unnamed>'),
      detailCount: details.length,
      topReachable,
      overflowX: docBox ? Math.max(0, Math.round(doc.scrollWidth - doc.clientWidth)) : 0,
    };
  });
  assert(composition.continuation, 'Overview offers no way to continue the work');
  assert(composition.continuationCount === 1,
    `Overview offers ${composition.continuationCount} continuations - it is meant to offer one`);
  assert(composition.canvasHeight > 140,
    `the circuit is ${composition.canvasHeight}px tall - it is meant to be the dominant object`);
  assert(!composition.facts.some((f) => f.includes('<missing>')),
    `Overview does not state its own state: ${JSON.stringify(composition.facts)}`);
  assert(composition.openDetails.length === 0,
    `Overview opens with disclosures already expanded: ${JSON.stringify(composition.openDetails)}`);
  assert(composition.topReachable, 'the Top editor is in the document but not reachable by a pointer');
  assert(composition.overflowX === 0, `Overview scrolls sideways by ${composition.overflowX}px`);
  console.log(`${at} ④ Overview: ${composition.canvasWidth}×${composition.canvasHeight} circuit, ` +
    `1 continuation "${composition.continuation}", ${composition.facts.join(' · ')}, ` +
    `${composition.detailCount} disclosures all closed, Top reachable, 0px sideways scroll`);

  // ── ⑤ The continuation and the circuit both lead somewhere in one action ────────────────
  await page.getByTestId('ide-project-overview-open-design-primary').click();
  await page.waitForTimeout(1400);
  const stage = () => page.evaluate(() =>
    document.querySelector('[data-ide-stage]')?.getAttribute('data-ide-stage') ?? null);
  assert((await stage()) === 'design', `opening the circuit from Overview landed on ${await stage()}`);
  await page.getByTestId('mode-button-project').click();
  await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 8000 });
  await page.getByTestId('ide-project-continue').click();
  await page.waitForTimeout(1400);
  const continued = await stage();
  assert(continued && continued !== 'project',
    `the continuation stayed on Project (${continued}) - Overview must not nominate itself`);
  console.log(`${at} ⑤ circuit -> design in one action; continuation -> ${continued}`);

  // ── ⑥ Problems is one shared panel, and Overview can open it ────────────────────────────
  await page.getByTestId('mode-button-project').click();
  await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 8000 });
  const problemsEntry = page.getByTestId('ide-project-open-problems');
  if ((await problemsEntry.count()) > 0) {
    await problemsEntry.first().click();
  } else {
    await page.getByTestId('ide-status-problems').click();
  }
  await page.waitForTimeout(700);
  const panel = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ide-workbench-console"]');
    if (!el) return { state: 'absent', height: 0 };
    return { state: el.getAttribute('data-console-state'), height: Math.round(el.getBoundingClientRect().height) };
  });
  assert(panel.state === 'expanded',
    `asking for the problems from Project produced a ${panel.state} panel of ${panel.height}px`);
  console.log(`${at} ⑥ Problems from Overview: expanded panel, ${panel.height}px`);

  // ── ⑦ Save, close, and come back to it ──────────────────────────────────────────────────
  await runCommand('project.save');
  const saved = await state();
  await runCommand('project.close');
  await page.waitForSelector(tid('ide-project-landing'), { timeout: 10000 });

  const closedSurface = await surface();
  const closedState = await state();
  assert(closedSurface.start && !closedSurface.overview, 'closing a project must return to Start');
  assert(closedState.nodes === 0, `closing left ${closedState.nodes} parts in the workspace`);
  const indexAfterClose = await savedIndex();
  assert(indexAfterClose.some((row) => row.endsWith(`|${saved.projectId}`)),
    `the closed project ${saved.projectId} is not in the saved list: ${JSON.stringify(indexAfterClose)}`);
  assert(indexAfterClose.length === 1,
    `closing one project left ${indexAfterClose.length} records: ${JSON.stringify(indexAfterClose)}`);
  console.log(`${at} ⑦ close -> Start; "${saved.projectName}" saved, and it is the only record`);

  // ── ⑧ Resume from Start restores the work, not a fresh copy of the lab ──────────────────
  await page.getByTestId('ide-project-start-section-recent').click();
  await page.waitForSelector(tid('ide-project-recent-panel'), { timeout: 10000 });
  const priority = await page.evaluate(() => {
    const marked = document.querySelector('[data-product-priority="primary"]');
    return marked ? marked.textContent.trim().replace(/\s+/g, ' ') : null;
  });
  assert(priority && priority.toLowerCase().startsWith('recent'),
    `with saved work, Start marks "${priority}" as the primary way in - it should be the reader's own work`);
  await page.getByTestId(`ide-project-recent-${saved.projectId}`).click();
  await page.waitForTimeout(400);
  await page.getByTestId(`ide-project-recent-open-${saved.projectId}`).click();
  await page.waitForTimeout(2200);
  const resumed = await state();
  assert(resumed.projectId === saved.projectId,
    `resuming opened ${resumed.projectId}, expected ${saved.projectId}`);
  assert(resumed.nodes === saved.nodes && resumed.nets === saved.nets,
    `resuming restored ${resumed.nodes}/${resumed.nets}, expected ${saved.nodes}/${saved.nets}`);
  await page.getByTestId('mode-button-project').click();
  await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 8000 });
  console.log(`${at} ⑧ resumed ${resumed.projectId} from Start: ${resumed.nodes} parts, ${resumed.nets} nets, Overview again`);

  await page.screenshot({ path: `${OUT}/overview-active-${width}x${height}.png` });

  // ── ⑨ A blank project a person deliberately made is open work ───────────────────────────
  await runCommand('project.close');
  await page.waitForSelector(tid('ide-project-landing'), { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/start-${width}x${height}.png` });
  await page.getByTestId('ide-project-build-fresh-primary').click();
  await page.waitForTimeout(1800);
  const blank = await state();
  assert(blank.nodes === 0, `"start blank" produced ${blank.nodes} parts`);
  // Building fresh puts you on the sheet, which is the point of the action.
  const blankLanding = await stage();
  assert(blankLanding === 'design', `"start blank" landed on ${blankLanding} rather than the sheet`);
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(1000);
  const blankSurface = await surface();
  assert(blankSurface.overview && !blankSurface.start,
    'a blank project a person deliberately created is open work and must get its Overview, not the catalogue');
  const blankCanvas = await page.getByTestId('ide-project-canvas-blank').isVisible();
  assert(blankCanvas, 'the empty project claims a circuit it does not have');
  const stillSaved = await savedIndex();
  assert(stillSaved.some((row) => row.endsWith(`|${saved.projectId}`)),
    `starting a blank project lost the saved one: ${JSON.stringify(stillSaved)}`);
  console.log(`${at} ⑨ blank project "${blank.projectName}" (${blank.projectKind}) opens on the sheet, ` +
    `gets its own Overview rather than the catalogue, ` +
    `says the sheet is empty, and the ${stillSaved.length} saved record(s) survive`);

  // ── ⑩ Evidence goes stale, and the Overview says so in words ────────────────────────────
  // One authority, projected. Simulate, the status bar and this line all read the same run scope,
  // so the check is that the Overview reports what happened - not that something turned orange.
  if (width === 1440) {
    // Put the blank project away and pick the saved one back up.
    await runCommand('project.close');
    await page.waitForSelector(tid('ide-project-landing'), { timeout: 10000 });
    await page.getByTestId('ide-project-start-section-recent').click();
    await page.waitForSelector(tid('ide-project-recent-panel'), { timeout: 10000 });
    await page.getByTestId(`ide-project-recent-${saved.projectId}`).click();
    await page.waitForTimeout(400);
    await page.getByTestId(`ide-project-recent-open-${saved.projectId}`).click();
    await page.waitForTimeout(2400);

    await page.getByTestId('mode-button-verify').click();
    await page.waitForTimeout(1200);
    await page.getByTestId('ide-vcb-run').click();
    await page.waitForTimeout(2600);

    const simulationFact = () => page.evaluate(() => {
      const row = document.querySelector('[data-testid="ide-project-fact-simulation"]');
      if (!row) return { value: '<missing>', tone: null };
      return { value: row.querySelector('dd')?.textContent.trim() ?? '', tone: row.getAttribute('data-tone') };
    });
    await page.getByTestId('mode-button-project').click();
    await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 8000 });
    const afterRun = await simulationFact();
    assert(!/not run/i.test(afterRun.value),
      `after a run the Overview still says "${afterRun.value}"`);
    assert(!/stale/i.test(afterRun.value),
      `a run made moments ago is not stale, but the Overview says "${afterRun.value}"`);

    // Now change the design under it.
    await page.getByTestId('mode-button-design').click();
    await page.waitForTimeout(1100);
    await page.locator('[data-node-id]').first().click({ force: true });
    await page.waitForTimeout(400);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1400);
    await page.getByTestId('mode-button-project').click();
    await page.waitForSelector(tid('ide-project-overview-document'), { timeout: 8000 });
    const afterEdit = await simulationFact();
    assert(/stale/i.test(afterEdit.value),
      `the design changed under a recorded run and the Overview says "${afterEdit.value}" ` +
      `(tone ${afterEdit.tone}) - the word is what a reader can act on, not the colour`);
    const statusRun = await page.evaluate(() =>
      document.querySelector('[data-testid="ide-status-run"]')?.textContent.trim() ?? '');
    assert(statusRun === '', 'The historical recording does not become global status in Project');
    console.log(`${at} ⑩ evidence: "${afterRun.value}" -> edit -> "${afterEdit.value}" (tone ${afterEdit.tone}), ` +
      `and run-specific state stays with its owning workspace`);
  }

  await page.screenshot({ path: `${OUT}/overview-blank-${width}x${height}.png` });

  // ── ⑪ A saved project can be deleted from Start, and only that one goes ─────────────────
  // Two presses on the item's own preview, the second naming the project. The workspace is
  // untouched because Start is only shown with nothing open.
  await runCommand('project.close');
  await page.waitForSelector(tid('ide-project-landing'), { timeout: 10000 });
  const indexBeforeDelete = await savedIndex();
  assert(indexBeforeDelete.some((row) => row.endsWith(`|${saved.projectId}`)),
    `the project to delete is not in the saved index: ${JSON.stringify(indexBeforeDelete)}`);
  await page.getByTestId('ide-project-start-section-recent').click();
  await page.waitForSelector(tid('ide-project-recent-panel'), { timeout: 10000 });
  await page.getByTestId(`ide-project-recent-${saved.projectId}`).click();
  await page.getByTestId(`ide-project-recent-delete-${saved.projectId}`).click();
  const indexDuringConfirm = await savedIndex();
  assert(indexDuringConfirm.length === indexBeforeDelete.length,
    'asking to delete must not delete anything before the confirmation');
  const confirmText = (await page.getByTestId('ide-project-recent-delete-confirm-row').innerText()).replace(/\s+/g, ' ');
  assert(confirmText.includes(saved.projectName), `the confirmation names "${saved.projectName}": "${confirmText}"`);
  await page.getByTestId('ide-project-recent-delete-confirm').click();
  await page.waitForTimeout(600);
  const indexAfterDelete = await savedIndex();
  assert(!indexAfterDelete.some((row) => row.endsWith(`|${saved.projectId}`)),
    `the deleted project is still in the saved index: ${JSON.stringify(indexAfterDelete)}`);
  assert(indexAfterDelete.length === indexBeforeDelete.length - 1,
    `deleting one project changed the index by ${indexBeforeDelete.length - indexAfterDelete.length}: ${JSON.stringify(indexAfterDelete)}`);
  assert((await page.locator(tid(`ide-project-recent-${saved.projectId}`)).count()) === 0,
    'the deleted project is still listed under Recent');
  const stillOnStart = await surface();
  assert(stillOnStart.start && !stillOnStart.overview, 'deleting a saved project must leave the reader on Start');
  console.log(`${at} ⑪ deleted "${saved.projectName}" from Start: index ${indexBeforeDelete.length} -> ${indexAfterDelete.length}, nothing else touched`);

  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`${at} PASS`);
}

try {
  await run(1440, 900);
  await run(1280, 650);
  console.log('\nPASS — Start and Overview are two experiences chosen by whether a project is open;' +
    '\n       browsing the catalogue reads without applying; a blank project is open work;' +
    '\n       close returns to Start and resume restores the same project, not a fresh lab.');
} finally {
  await browser.close();
}
