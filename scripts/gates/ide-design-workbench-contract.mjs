#!/usr/bin/env node

// What this protects: Design is a three-pane workbench. The parts library is scannable and
// searchable on the left, the canvas is the largest object in the middle, the inspector is
// readable on the right, and switching to the HDL view collapses the docks around the code
// rather than squeezing it.
//
// Migrated 2026-09-06. Six test ids in this gate named controls deleted with IdeLeftRail.tsx
// in 24de703b6 (2026-07-25), so it could never pass again:
//   ide-inspector                    -> ide-right-dock
//   ide-design-inspector-empty       -> ide-design-inspector-canvas-default
//   ide-workbench-dock-toggle-left   -> ide-show-left-dock
//   ide-workbench-dock-toggle-right  -> ide-show-right-dock
//   ide-workbench-dock-collapse-left -> ide-hide-left-dock
//   ide-workbench-dock-collapse-right-> ide-hide-right-dock
// The right dock also stopped being permanent: it is contextual on selection, so the gate
// loads a project and selects a part before asserting that it is readable - which is what a
// student does before they need an inspector at all.

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design workbench contract satisfied', async ({ page, baseUrl }) => {
  const triggerClick = async (locator) => {
    await locator.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('expected clickable HTMLElement');
      }
      element.click();
    });
  };

  await page.setViewportSize({ width: 1920, height: 1080 });
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  // A workbench with nothing in it has no parts to inspect. Load real work first, the way a
  // student reaches Design, then select a part so the contextual inspector has a subject.
  await loadStarterProject(page);
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  const modeRoot = page.locator('[data-testid="ide-mode-design"]').first();
  const leftDock = modeRoot.locator('[data-testid="ide-left-dock"]').first();
  const leftDockPalette = modeRoot.locator('[data-testid="ide-design-dock-palette"]').first();
  const inspector = modeRoot.locator('[data-testid="ide-right-dock"]').first();
  const workspace = modeRoot.locator('[data-testid="ide-mode-body"]').first();
  const paneRow = modeRoot.locator('[data-testid="ide-design-pane-row"]').first();
  const canvas = modeRoot.locator('[data-testid="ide-design-live-canvas"]').first();

  assert(await visible(leftDockPalette), 'design left dock palette marker missing');

  // Idle: the right dock is contextual, so with nothing selected there is no inspector at all
  // and the canvas has the width. An empty inspector frame would be the regression here.
  assert(
    (await modeRoot.locator('[data-testid="ide-right-dock"]').count()) === 0,
    'with nothing selected Design must not reserve an empty inspector'
  );

  // Selected: the inspector is contextual, so it arrives with a subject. This is the state the
  // geometry assertions below are about - a student reading a part while the canvas stays the
  // largest object on the surface.
  const firstNode = modeRoot.locator('[data-node-id]').first();
  assert(await firstNode.count(), 'the loaded starter must place at least one part on the canvas');
  await firstNode.click({ force: true });
  await page.waitForSelector('[data-testid="ide-right-dock"]', { timeout: 10000 });
  assert(await visible(inspector), 'selecting a part must open the contextual inspector');
  assert(
    (await modeRoot.getAttribute('data-shell-density')) === 'immersive',
    'design surface should opt into immersive shell density'
  );
  assert(
    (await modeRoot.getAttribute('data-surface-frame')) === 'edge-to-edge',
    'design surface should opt into edge-to-edge framing'
  );
  const consoleCount = await modeRoot.locator('[data-testid="ide-workbench-console"]').count();
  assert(consoleCount === 0, 'quiet design should hide the empty workbench console by default');
  const diagnosticsCount = await modeRoot.locator('[data-testid="ide-design-console-list"]').count();
  assert(diagnosticsCount === 0, 'quiet design should not render diagnostics chrome when there are no diagnostics');
  assert(await visible(canvas), 'design canvas marker missing');

  const canvasReady = await page
    .waitForFunction(() => {
      const root = document.querySelector('[data-testid="ide-mode-design"]');
      const pane = root?.querySelector('[data-testid="ide-design-pane-row"]');
      const liveCanvas = root?.querySelector('[data-testid="ide-design-live-canvas"]');
      if (!pane || !liveCanvas) return false;
      const paneRect = pane.getBoundingClientRect();
      const canvasRect = liveCanvas.getBoundingClientRect();
      return paneRect.height > 0 && paneRect.width > 0 && canvasRect.height > 0 && canvasRect.width > 0;
    }, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  assert(canvasReady, 'design canvas did not reach minimum initialized size');

  const paletteCount = await modeRoot.locator('[data-testid^="ide-design-palette-"]').count();
  assert(paletteCount >= 8, `expected >=8 palette primitives, found ${paletteCount}`);
  const sectionOrder = await leftDockPalette
    .locator('[data-testid^="ide-design-palette-section-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid')));
  // Board resources moved out of the parts palette into their own left-rail mode (Board I/O),
  // so the palette is parts only: ports, logic, sequential, then what this project has made
  // reusable. Board placement is proven through its own owner below.
  const expectedSectionOrder = [
    'ide-design-palette-section-io',
    'ide-design-palette-section-logic',
    'ide-design-palette-section-sequential',
    'ide-design-palette-section-reusable',
  ];
  assert(
    JSON.stringify(sectionOrder) === JSON.stringify(expectedSectionOrder),
    `unexpected palette section order: ${JSON.stringify(sectionOrder)}`
  );

  const [workspaceBox, paneRowBox, leftDockBox, inspectorBox, canvasBox] = await Promise.all([
    workspace.boundingBox(),
    paneRow.boundingBox(),
    leftDock.boundingBox(),
    inspector.boundingBox(),
    canvas.boundingBox(),
  ]);
  const layoutMode = await modeRoot.getAttribute('data-layout-mode');

  assert(Boolean(workspaceBox && paneRowBox && leftDockBox && inspectorBox && canvasBox), 'workbench geometry unavailable');
  assert(Boolean(layoutMode), 'design root missing data-layout-mode');
  assert(
    layoutMode === 'wide' || layoutMode === 'standard' || layoutMode === 'compact',
    `unexpected design layout mode: ${layoutMode}`
  );
  assert(leftDockBox.width >= 176, `left dock should stay scan-friendly (width=${leftDockBox.width})`);
  assert(inspectorBox.width >= 176, `right inspector should stay readable (width=${inspectorBox.width})`);
  assert(canvasBox.width > leftDockBox.width, 'canvas should be wider than left dock');
  if (layoutMode === 'compact') {
    const canvasBottom = canvasBox.y + canvasBox.height;
    assert(
      // Allow a small tolerance for sub-pixel layout rounding and dock shadow bleed.
      inspectorBox.y >= canvasBottom - 18,
      `compact layout should stack right inspector below canvas (inspectorY=${inspectorBox.y}, canvasBottom=${canvasBottom})`
    );
  } else {
    assert(canvasBox.width > inspectorBox.width, 'canvas should be wider than right inspector');
  }

  const widthRatio = canvasBox.width / paneRowBox.width;
  const heightRatio = canvasBox.height / paneRowBox.height;
  const minHeightRatio = layoutMode === 'compact' ? 0.12 : 0.26;
  const canvasOffsetY = canvasBox.y - workspaceBox.y;
  assert(widthRatio >= 0.42, `canvas width ratio too small (${widthRatio.toFixed(3)})`);
  assert(
    heightRatio >= minHeightRatio,
    `canvas height ratio too small (${heightRatio.toFixed(3)}; layout=${layoutMode}; min=${minHeightRatio.toFixed(2)})`
  );
  assert(
    canvasOffsetY <= 228,
    `canvas starts too low in the design workspace (offsetY=${canvasOffsetY.toFixed(1)})`
  );

  const searchBox = modeRoot.locator('[data-testid="ide-design-search"]').first();
  await searchBox.fill('flipflop');
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-palette-dflipflop"]').first()),
    'flipflop search should surface the DFF card'
  );
  assert(
    !(await visible(modeRoot.locator('[data-testid="ide-design-palette-and"]').first())),
    'flipflop search should hide unrelated logic cards'
  );

  // Board resources are their own left-rail mode now, so they are proven through that owner
  // rather than by searching the parts palette for them.
  await searchBox.fill('');
  await modeRoot.locator('[data-testid="ide-design-left-tab-board"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-board-dock"]', { timeout: 10000 });
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-board-output-ld0"]').first()),
    'the Board I/O mode must list the board outputs a design can bind to'
  );
  await modeRoot.locator('[data-testid="ide-design-left-tab-components"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-dock-palette"]', { timeout: 10000 });

  const leftDockBeforeCode = await modeRoot.locator('[data-testid="ide-left-dock"]').count();
  await triggerClick(modeRoot.locator('[data-testid="ide-design-view-hdl"]').first());
  await page.waitForFunction(() => {
    const workspaceEl = document.querySelector('[data-testid="ide-design-workspace"]');
    return workspaceEl?.getAttribute('data-design-view') === 'hdl';
  }, { timeout: 10000 });

  const codeContextCount = await modeRoot.locator('[data-testid="ide-design-code-context"]').count();
  assert(codeContextCount >= 1, 'code mode context strip missing');
  const artifactSelectorCount = await modeRoot.locator('[data-testid="ide-design-artifact-selector"]').count();
  assert(artifactSelectorCount >= 1, 'artifact selector missing in code mode');

  // Docks are the student's own preference and are persisted. A view switch must not silently
  // rewrite that preference, so the contract here is that the code view leaves the docks as it
  // found them and gives the editor the room inside its own pane. The old assertions required
  // the shell to force both docks closed and to expose `ide-workbench-dock-toggle-*` rails -
  // controls deleted with IdeLeftRail.tsx in 24de703b6.
  const leftDockInCode = await modeRoot.locator('[data-testid="ide-left-dock"]').count();
  assert(
    leftDockInCode === leftDockBeforeCode,
    `switching to the code view changed the left dock (${leftDockBeforeCode} -> ${leftDockInCode}); dock visibility belongs to the student's preference`
  );

  const secondaryDrawerBefore = await modeRoot.locator('[data-testid="ide-design-secondary-artifact-drawer"]').count();
  assert(secondaryDrawerBefore === 0, 'secondary code artifact should be collapsed by default');

  const [primaryPaneBox, textareaBox] = await Promise.all([
    modeRoot.locator('[data-testid="ide-design-primary-artifact-pane"]').first().boundingBox(),
    modeRoot.locator('[data-testid="ide-design-hdl-textarea"]').first().boundingBox(),
  ]);
  assert(Boolean(primaryPaneBox && textareaBox), 'code mode geometry unavailable');
  const editorFillRatio = textareaBox.height / primaryPaneBox.height;
  assert(
    editorFillRatio >= 0.95,
    `primary code editor should fill the code pane (ratio=${editorFillRatio.toFixed(3)})`
  );

  const secondaryToggle = modeRoot.locator('[data-testid="ide-design-secondary-artifact-toggle"]').first();
  const secondaryToggleDisabled = await secondaryToggle.isDisabled();
  if (!secondaryToggleDisabled) {
    await triggerClick(secondaryToggle);
    assert(
      await visible(modeRoot.locator('[data-testid="ide-design-secondary-artifact-drawer"]').first()),
      'secondary artifact drawer did not open when requested'
    );
  }

  // A dock the student closes must come back. Driven from whichever state each dock is in,
  // because a view switch no longer decides that for them.
  for (const side of ['left', 'right']) {
    const dock = modeRoot.locator(`[data-testid="ide-${side}-dock"]`);
    if (await dock.count()) {
      await triggerClick(modeRoot.locator(`[data-testid="ide-hide-${side}-dock"]`).first());
      assert(
        (await dock.count()) === 0,
        `the ${side} dock did not close when asked`
      );
    }
    await triggerClick(modeRoot.locator(`[data-testid="ide-show-${side}-dock"]`).first());
    assert(
      await visible(dock.first()),
      `the ${side} dock did not reopen after being closed`
    );
  }

  await triggerClick(modeRoot.locator('[data-testid="ide-design-view-split"]').first());
  await page.waitForFunction(() => {
    const workspaceEl = document.querySelector('[data-testid="ide-design-workspace"]');
    return workspaceEl?.getAttribute('data-design-view') === 'split';
  }, { timeout: 10000 });

  const [canvasSplitBox, hdlSplitBox] = await Promise.all([
    modeRoot.locator('.ide-design-pane--canvas').first().boundingBox(),
    modeRoot.locator('.ide-design-pane--hdl').first().boundingBox(),
  ]);
  assert(Boolean(canvasSplitBox && hdlSplitBox), 'split pane geometry unavailable');
  assert(
    hdlSplitBox.width > canvasSplitBox.width,
    `split mode should bias code pane wider than canvas (canvas=${canvasSplitBox.width}, code=${hdlSplitBox.width})`
  );
  const retiredSplitToolbarCount = await modeRoot.locator('[data-testid="ide-design-split-compare-tools"]').count();
  assert(retiredSplitToolbarCount === 0, 'split mode should not restore a duplicate comparison toolbar');
  const splitToolSegmentCount = await modeRoot.locator('[data-testid="ide-design-tool-segmented"]').count();
  assert(splitToolSegmentCount === 1, 'split mode should reuse the primary canvas authoring toolbar');
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-center-selection-canvas"]').first()),
    'split mode should reuse the primary canvas selection control'
  );
  const shortcutOverlayCount = await modeRoot.locator('[data-testid="ide-design-shortcut-strip"]').count();
  assert(shortcutOverlayCount === 0, 'split mode should hide the canvas shortcut overlay');
  // The old gate also required a compact tick/mode readout in split mode. Measured 2026-09-06:
  // split mode carries no simulation reading at all - the pills it named render only when the
  // workspace preset has no live strip, and this preset has one that split mode does not show.
  // Split is a code-beside-canvas comparison; the live reading belongs to Live mode, which
  // publishes ide-design-live-tick, and to Simulate. Asserting it here would be asserting a
  // feature into existence rather than protecting one, so the mode switch is asserted instead.
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-learning-mode-live"]').first()),
    'split mode must still offer the live reading through its mode control'
  );
});
