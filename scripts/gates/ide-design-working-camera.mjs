#!/usr/bin/env node

// The Design canvas keeps a student's working view.
//
// Reproduced on 2026-10-05 at 1366x768: selecting a part opened the inspector and the whole
// circuit was refitted into the narrower sheet (127% -> 88%, schematic names 15.9px -> 11px);
// a deliberate zoom was then discarded on Design -> Simulate -> Design. This gate asserts the
// corrected behaviour through normal controls:
//   - selecting a part, and opening the inspector with it, does not change the zoom;
//   - the selected part stays on the sheet;
//   - a manual zoom and pan survive selection, deselection and a trip through Simulate;
//   - Fit is still an explicit way to frame the whole circuit;
//   - the view belongs to a project: closing and reopening it returns to it, Save As keeps the
//     student where they are, the copy and the original then keep separate views, and a
//     project not yet looked at is framed on its own terms;
//   - the view belongs to a module: a definition opened for the first time is framed, and
//     the parent and the definition each return to their own view;
//   - the command row keeps one height: selecting a part, exploring, and placing the first
//     part of an unfinished design (which adds a status chip) neither wrap it nor clip its
//     commands, and a part placed near the edge of the sheet is still on it afterwards.
// Projects are switched the way a student switches them: File > Save / Save As / Close, then
// Resume from the saved list. The remembered view lasts for the session; a reload starts fresh.

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

async function camera(page) {
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    const zoomText = document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent ?? '';
    const node = document.querySelector('[data-node-id="en_node"], [data-node-id]');
    const svg = node?.closest('svg');
    const title = svg?.querySelector('.rb-sym-title');
    const matrix = title?.getScreenCTM();
    const sheet = svg?.getBoundingClientRect();
    const box = node?.getBoundingClientRect();
    return {
      zoom: Number.parseInt(zoomText, 10),
      namePx: matrix && title ? Math.round(Number.parseFloat(getComputedStyle(title).fontSize) * Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) * 10) / 10 : null,
      sheet: sheet ? { left: sheet.left, right: sheet.right, top: sheet.top, bottom: sheet.bottom, width: sheet.width } : null,
      firstNode: box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null,
      toolbarHeight: document.querySelector('[data-testid="ide-design-toolbar"]')?.closest('.ide-surface-command-stack')?.getBoundingClientRect().height ?? null,
      inspectorOpen: Boolean(document.querySelector('[data-testid="ide-right-dock"]')?.checkVisibility?.()),
    };
  });
}

/** A camera is the same when the zoom and the on-screen place of a part both agree. */
function assertSameView(actual, expected, label) {
  assert(actual.zoom === expected.zoom, `${label}: zoom ${expected.zoom}% became ${actual.zoom}%`);
  assert(actual.firstNode && expected.firstNode, `${label}: the reference part must be measurable in both views`);
  const dx = Math.abs(actual.firstNode.left - expected.firstNode.left);
  const dy = Math.abs(actual.firstNode.top - expected.firstNode.top);
  assert(dx <= 1.5 && dy <= 1.5, `${label}: the sheet moved by ${dx.toFixed(1)}px, ${dy.toFixed(1)}px`);
}

function assertDifferentView(actual, other, label) {
  const moved = actual.firstNode && other.firstNode
    ? Math.abs(actual.firstNode.left - other.firstNode.left) + Math.abs(actual.firstNode.top - other.firstNode.top)
    : 0;
  assert(actual.zoom !== other.zoom || moved > 4, `${label}: the two views are indistinguishable (${actual.zoom}%), so nothing was proven`);
}

async function fileCommand(page, commandId) {
  await page.locator('[data-testid="ide-menu-file"]').click();
  await page.locator(`[data-testid="ide-menu-item-${commandId}"]`).click();
  await page.waitForTimeout(900);
}

async function savedProjectIds(page) {
  await page.waitForSelector('[data-testid="ide-project-recent-panel"]', { timeout: 15000 });
  return page.locator('[data-testid^="ide-project-recent-"]').evaluateAll((rows) =>
    rows
      .map((row) => row.getAttribute('data-testid') ?? '')
      .filter((id) => !/^ide-project-recent-(panel|open-|delete-)/.test(id))
      .map((id) => id.replace('ide-project-recent-', ''))
  );
}

async function closeToStart(page) {
  await fileCommand(page, 'project.close');
  return savedProjectIds(page);
}

async function resumeInDesign(page, projectId, nodeSelector) {
  await page.locator(`[data-testid="ide-project-recent-${projectId}"]`).click();
  await page.locator(`[data-testid="ide-project-recent-open-${projectId}"]`).click();
  await page.waitForSelector('[data-testid="mode-button-design"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector(nodeSelector, { timeout: 15000 });
}

/** A deliberate view: wheel zoom away from the centre, then a middle-button drag. */
async function panAndZoom(page) {
  const sheet = await page.locator('[data-node-id="en_node"]').first().evaluate((node) => {
    const box = node.closest('svg').getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  const px = sheet.left + sheet.width * 0.35;
  const py = sheet.top + sheet.height * 0.4;
  await page.mouse.move(px, py);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(700);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(px + 46, py + 28, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  // The wheel carries momentum. Wait until the view has stopped before anything is compared
  // with it.
  let last = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const now = await camera(page);
    if (last && now.zoom === last.zoom && now.firstNode.left === last.firstNode.left && now.firstNode.top === last.firstNode.top) return;
    last = now;
  }
  throw new Error('the view never came to rest after a wheel zoom');
}

/** The Design command area: its height, and whether its commands are whole. */
async function commandRow(page) {
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const stack = document.querySelector('[data-testid="ide-design-toolbar"]')?.closest('.ide-surface-command-stack');
    const header = document.querySelector('[data-testid="ide-design-control-bar"]');
    const area = stack?.getBoundingClientRect();
    const whole = (id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      if (!element || !area) return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.left >= area.left - 0.5 && box.right <= area.right + 0.5 &&
        box.top >= area.top - 0.5 && box.bottom <= area.bottom + 0.5 && element.scrollWidth <= element.clientWidth + 1;
    };
    return {
      height: area ? Math.round(area.height) : null,
      overflowing: header ? header.scrollWidth > header.clientWidth + 1 : null,
      explore: whole('ide-design-explore'),
      test: whole('ide-design-test-design'),
      tools: whole('ide-design-tool-select'),
      inspectorOpen: Boolean(document.querySelector('[data-testid="ide-right-dock"]')?.checkVisibility?.()),
    };
  });
}

function assertCommandRow(row, expectedHeight, label) {
  assert(row.height === expectedHeight, `${label}: the command area changed height ${expectedHeight}px -> ${row.height}px`);
  assert(row.overflowing === false, `${label}: the command row's right-hand group overflows`);
  assert(row.tools && row.explore && row.test, `${label}: a command is cut off or pushed out of the row (tools ${row.tools}, Explore ${row.explore}, Test ${row.test})`);
}

function assertOnSheet(state, label) {
  assert(state.firstNode && state.sheet, `${label}: the part and the sheet must be measurable`);
  assert(
    state.firstNode.left >= state.sheet.left - 1 && state.firstNode.right <= state.sheet.right + 1 &&
      state.firstNode.top >= state.sheet.top - 1 && state.firstNode.bottom <= state.sheet.bottom + 1,
    `${label}: the selected part must stay on the sheet (part ${JSON.stringify(state.firstNode)}, sheet ${JSON.stringify(state.sheet)})`
  );
}

/** Each part of this gate starts as a student with nothing stored: a signal focus left by an
 *  earlier part is remembered across reloads and keeps the inspector open, which would hide
 *  the very resize this gate is about. */
async function asNewStudent(hostPage, viewport, run) {
  const context = await hostPage.context().browser().newContext({ serviceWorkers: 'block', viewport });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
    await run(page);
  } finally {
    await context.close();
  }
}

await runIdeGate('IDE design working camera preserved', async ({ page: hostPage, baseUrl }) => {
  for (const viewport of VIEWPORTS) await asNewStudent(hostPage, viewport, async (page) => {
    const label = `${viewport.width}x${viewport.height}`;
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-working-camera`);
    await page.waitForSelector('[data-testid="mode-button-project"]', { timeout: 20000 });
    await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-node-id="en_node"]', { timeout: 15000 });

    const entry = await camera(page);
    assert(entry.zoom >= 60, `${label}: initial framing must be a usable scale, got ${entry.zoom}%`);
    assert(!entry.inspectorOpen, `${label}: nothing is selected on entry, so no inspector is open`);

    // Selecting a part opens the inspector. The zoom must not change and the part stays in view.
    await page.locator('[data-node-id="en_node"]').first().click();
    const selected = await camera(page);
    assert(selected.inspectorOpen, `${label}: selecting a part must open its inspector`);
    assert(selected.zoom === entry.zoom, `${label}: selecting a part changed the zoom ${entry.zoom}% -> ${selected.zoom}%`);
    assert(selected.namePx === entry.namePx, `${label}: selecting a part changed schematic name size ${entry.namePx}px -> ${selected.namePx}px`);
    assertOnSheet(selected, `${label} after selection`);
    assert(selected.toolbarHeight === entry.toolbarHeight, `${label}: selecting a part changed the command area height ${entry.toolbarHeight}px -> ${selected.toolbarHeight}px`);

    // Fit and zoom stay reachable on the sheet while the inspector is open.
    for (const id of ['ide-design-fit-circuit-canvas', 'ide-design-zoom-in', 'ide-design-zoom-out', 'ide-design-zoom-readout']) {
      assert(await visible(page.locator(`[data-testid="${id}"]`).first()), `${label}: ${id} must be visible with the inspector open`);
    }

    // The command row is whole with the inspector open.
    assertCommandRow(await commandRow(page), entry.toolbarHeight, `${label} with a part selected`);

    // A deliberate zoom is the student's: it survives selection, deselection and leaving Design.
    await page.locator('[data-testid="ide-design-zoom-in"]').first().click();
    const zoomed = await camera(page);
    assert(zoomed.zoom > entry.zoom, `${label}: zoom in must increase the zoom (${entry.zoom}% -> ${zoomed.zoom}%)`);
    await page.keyboard.press('Escape');
    await page.locator('[data-node-id="en_node"]').first().click();
    const reselected = await camera(page);
    assert(reselected.zoom === zoomed.zoom, `${label}: selection discarded a deliberate zoom ${zoomed.zoom}% -> ${reselected.zoom}%`);

    await page.locator('[data-testid="mode-button-verify"]').click();
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-node-id="en_node"]', { timeout: 15000 });
    const returned = await camera(page);
    assert(returned.zoom === zoomed.zoom, `${label}: returning from Simulate reset the zoom ${zoomed.zoom}% -> ${returned.zoom}%`);
    assert(returned.namePx === zoomed.namePx, `${label}: returning from Simulate changed schematic name size ${zoomed.namePx}px -> ${returned.namePx}px`);

    await page.locator('[data-testid="mode-button-hardware"]').click();
    await page.locator('[data-testid="mode-button-export"]').click();
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-node-id="en_node"]', { timeout: 15000 });
    const afterTour = await camera(page);
    assert(afterTour.zoom === zoomed.zoom, `${label}: visiting Board and Package reset the zoom ${zoomed.zoom}% -> ${afterTour.zoom}%`);

    // Fit remains an explicit overview.
    await page.keyboard.press('Escape');
    await page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first().click();
    const fitted = await camera(page);
    assert(fitted.zoom !== zoomed.zoom, `${label}: Fit must reframe the circuit (still ${fitted.zoom}%)`);

    // Exploring is a mode with a strip of its own: the height changes when the student turns
    // it on and off, and at no other time - not when a part is selected while exploring.
    const explore = page.locator('[data-testid="ide-design-explore"]').first();
    await explore.click();
    assert((await explore.getAttribute('aria-pressed')) === 'true', `${label}: Explore must switch on`);
    const exploring = await commandRow(page);
    assert(exploring.height > entry.toolbarHeight, `${label}: exploring must show its own strip (${entry.toolbarHeight}px -> ${exploring.height}px)`);
    assert(exploring.overflowing === false && exploring.tools && exploring.explore && exploring.test, `${label}: a command is cut off while exploring`);
    const zoomWhileExploring = (await camera(page)).zoom;
    await page.locator('[data-node-id="xor0"]').first().click();
    const exploringSelected = await commandRow(page);
    assert(exploringSelected.inspectorOpen, `${label}: a part selected while exploring opens the inspector`);
    assertCommandRow(exploringSelected, exploring.height, `${label} selecting a part while exploring`);
    assert((await camera(page)).zoom === zoomWhileExploring, `${label}: selecting a part while exploring changed the zoom`);
    await explore.click();
    assert((await explore.getAttribute('aria-pressed')) !== 'true', `${label}: Explore must switch off`);
    assertCommandRow(await commandRow(page), entry.toolbarHeight, `${label} after exploring`);
  });

  // ── An unfinished design: the first part, placed near the edge of the sheet ──────────
  for (const viewport of VIEWPORTS) await asNewStudent(hostPage, viewport, async (page) => {
    const label = `${viewport.width}x${viewport.height} blank project`;
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-working-camera-blank`);
    await page.waitForSelector('[data-testid="ide-project-build-fresh-primary"]', { timeout: 20000 });
    await page.locator('[data-testid="ide-project-build-fresh-primary"]').first().click();
    await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
    const empty = await commandRow(page);
    assert(!empty.inspectorOpen, `${label}: nothing is selected on an empty sheet`);
    assert(empty.test && empty.tools, `${label}: the commands must be whole on an empty sheet`);

    await page.locator('[data-testid="ide-design-palette-and"]').first().click();
    const sheet = await page.locator('[data-testid="ide-design-live-canvas"]').first().boundingBox();
    // Near the right edge of the wide sheet: where the inspector is about to open.
    await page.mouse.click(sheet.x + sheet.width * 0.92, sheet.y + sheet.height * 0.5);
    await page.waitForSelector('[data-node-id]', { timeout: 8000 });
    const placed = await commandRow(page);
    assert(placed.inspectorOpen, `${label}: placing a part selects it and opens its inspector`);
    assertCommandRow(placed, empty.height, `${label} after the first part`);
    const part = await page.evaluate(() => {
      const body = document.querySelector('[data-node-id] .rb-sym-body').getBoundingClientRect();
      const area = document.querySelector('[data-testid="ide-design-live-canvas"]').getBoundingClientRect();
      return { onSheet: body.left >= area.left && body.right <= area.right && body.top >= area.top && body.bottom <= area.bottom, zoom: document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent };
    });
    assert(part.onSheet, `${label}: the part just placed must still be on the sheet once the inspector has opened`);
    assert(part.zoom === '100%', `${label}: placing a part must not change the zoom, it reads ${part.zoom}`);

    // Escape puts the tool down and clears the selection; the part must not slip under the
    // inspector, which stays open on the signal in focus.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const released = await commandRow(page);
    assertCommandRow(released, empty.height, `${label} after Escape`);
    const still = await page.evaluate(() => {
      const body = document.querySelector('[data-node-id] .rb-sym-body').getBoundingClientRect();
      const area = document.querySelector('[data-testid="ide-design-live-canvas"]').getBoundingClientRect();
      return body.left >= area.left && body.right <= area.right;
    });
    assert(still, `${label}: the part must stay on the sheet after Escape`);
  });

  await asNewStudent(hostPage, VIEWPORTS[0], async (page) => {
  // ── The view belongs to the project ──────────────────────────────────────────────
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-working-camera-scope`);
  await page.waitForSelector('[data-testid="mode-button-project"]', { timeout: 20000 });
  await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
  await fileCommand(page, 'project.save');
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-node-id="en_node"]', { timeout: 15000 });
  const framed = await camera(page);
  await panAndZoom(page);
  const original = await camera(page);
  assert(original.zoom > framed.zoom, `a wheel zoom must change the zoom (${framed.zoom}% -> ${original.zoom}%)`);
  assertDifferentView(original, framed, 'manual pan and zoom');
  // The wheel anchors the zoom under the pointer and the drag moves the sheet; either alone
  // could leave the zoom readout right and the sheet in the wrong place.
  const afterWheelOnly = { ...original, firstNode: { ...original.firstNode } };

  // Close the project and reopen it from the saved list.
  const afterFirstClose = await closeToStart(page);
  assert(afterFirstClose.length === 1, `one saved project is expected after the first save, found ${JSON.stringify(afterFirstClose)}`);
  const originalId = afterFirstClose[0];
  await resumeInDesign(page, originalId, '[data-node-id="en_node"]');
  assertSameView(await camera(page), afterWheelOnly, 'reopening the project from the saved list');

  // Save As: the same work under a new identity. The view must not jump.
  await fileCommand(page, 'project.save-as');
  await page.getByTestId('ide-save-as-dialog').waitFor({ state: 'visible' });
  await page.getByTestId('ide-save-as-confirm').click();
  await page.getByTestId('ide-save-as-dialog').waitFor({ state: 'hidden' });
  assertSameView(await camera(page), original, 'Save As while looking at the circuit');
  await page.locator('[data-testid="ide-design-zoom-in"]').first().click();
  await page.locator('[data-testid="ide-design-zoom-in"]').first().click();
  const copy = await camera(page);
  assert(copy.zoom > original.zoom, `zooming the copy must change its zoom (${original.zoom}% -> ${copy.zoom}%)`);

  const afterSecondClose = await closeToStart(page);
  assert(afterSecondClose.length === 2 && afterSecondClose.includes(originalId),
    `Save As must leave two saved projects including the original, found ${JSON.stringify(afterSecondClose)}`);
  const copyId = afterSecondClose.find((id) => id !== originalId);
  assert(copyId, 'the copy must have its own saved identity');

  // The original did not take on the copy's view, and the copy kept its own.
  await resumeInDesign(page, originalId, '[data-node-id="en_node"]');
  const originalAgain = await camera(page);
  assertSameView(originalAgain, original, 'the original after the copy was zoomed');
  assertDifferentView(originalAgain, copy, 'original versus copy');
  await closeToStart(page);
  await resumeInDesign(page, copyId, '[data-node-id="en_node"]');
  assertSameView(await camera(page), copy, 'the copy after the original was reopened');

  // ── The view belongs to the module ───────────────────────────────────────────────
  const partsBefore = await page.locator('[data-node-id]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('data-node-id')))]);
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first().click();
  await page.waitForTimeout(450);
  await page.locator('[data-node-id="xor1"]').first().click();
  await page.locator('[data-node-id="and_en"]').first().click({ modifiers: ['Shift'] });
  await page.locator('[data-testid="ide-design-create-module-open"]').click();
  await page.waitForSelector('[data-testid="ide-design-create-module-dialog"]', { timeout: 8000 });
  const confirm = page.locator('[data-testid="ide-design-create-module-confirm"]');
  assert(await confirm.isEnabled(), 'the selected parts must be accepted as a component');
  await confirm.click();
  await page.waitForTimeout(900);
  const partsAfter = await page.locator('[data-node-id]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('data-node-id')))]);
  const instanceId = partsAfter.find((id) => !partsBefore.includes(id));
  assert(instanceId, `creating a component must put an instance on the sheet (${JSON.stringify(partsAfter)})`);

  await page.keyboard.press('Escape');
  await page.locator('[data-testid="ide-design-zoom-in"]').first().click();
  const parentView = await camera(page);
  await page.locator(`[data-node-id="${instanceId}"]`).first().click();
  await page.locator('[data-testid="ide-design-open-module-definition"]').click();
  await page.waitForSelector('[data-testid="ide-design-breadcrumb-instance"], .rb-design-breadcrumb .is-current', { timeout: 8000 });
  await page.waitForSelector('[data-node-id="xor1"]', { timeout: 8000 });
  const definitionFramed = await camera(page);
  assert(definitionFramed.zoom >= 60, `a definition opened for the first time must be framed at a usable scale, got ${definitionFramed.zoom}%`);
  const insideSheet = await page.locator('[data-node-id="xor1"]').first().evaluate((node) => {
    const box = node.getBoundingClientRect();
    const sheet = node.closest('svg').getBoundingClientRect();
    return box.left >= sheet.left && box.right <= sheet.right && box.top >= sheet.top && box.bottom <= sheet.bottom;
  });
  assert(insideSheet, 'a definition opened for the first time must show its parts');
  await page.locator('[data-testid="ide-design-zoom-out"]').first().click();
  await page.locator('[data-testid="ide-design-zoom-out"]').first().click();
  const definitionView = await camera(page);
  assert(definitionView.zoom < definitionFramed.zoom, `zooming out inside the definition must change its zoom (${definitionFramed.zoom}% -> ${definitionView.zoom}%)`);

  // Back to the parent through the breadcrumb, then into the definition again.
  await page.locator('[data-testid="ide-design-module-breadcrumb"] button').first().click();
  await page.waitForSelector(`[data-node-id="${instanceId}"]`, { timeout: 8000 });
  const parentAgain = await camera(page);
  assert(parentAgain.zoom === parentView.zoom, `returning to the parent changed its zoom ${parentView.zoom}% -> ${parentAgain.zoom}%`);
  assert(parentAgain.zoom !== definitionView.zoom, 'the parent and the definition must have distinguishable views for this to prove anything');
  await page.locator(`[data-node-id="${instanceId}"]`).first().click();
  await page.locator('[data-testid="ide-design-open-module-definition"]').click();
  await page.waitForSelector('[data-node-id="xor1"]', { timeout: 8000 });
  const definitionAgain = await camera(page);
  assert(definitionAgain.zoom === definitionView.zoom, `reopening the definition changed its zoom ${definitionView.zoom}% -> ${definitionAgain.zoom}%`);

  // ── A project not yet looked at is framed on its own terms ───────────────────────
  await page.locator('[data-testid="ide-design-module-breadcrumb"] button').first().click();
  await closeToStart(page);
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  const fresh = await camera(page);
  assert(fresh.zoom >= 60, `a project not yet looked at must be framed at a usable scale, got ${fresh.zoom}%`);
  // It arrived framed: pressing Fit changes nothing. Had it inherited the counter's view, Fit
  // would move it.
  await page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first().click();
  assertSameView(await camera(page), fresh, 'Fit on a project that was just opened for the first time');
  });
});
