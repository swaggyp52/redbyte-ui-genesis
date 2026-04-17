#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

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
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  const modeRoot = page.locator('[data-testid="ide-mode-design"]').first();
  const leftDock = modeRoot.locator('[data-testid="ide-left-dock"]').first();
  const leftDockPalette = modeRoot.locator('[data-testid="ide-design-dock-palette"]').first();
  const inspector = modeRoot.locator('[data-testid="ide-inspector"]').first();
  const workspace = modeRoot.locator('[data-testid="ide-mode-body"]').first();
  const paneRow = modeRoot.locator('[data-testid="ide-design-pane-row"]').first();
  const canvas = modeRoot.locator('[data-testid="ide-design-live-canvas"]').first();

  assert(await visible(leftDockPalette), 'design left dock palette marker missing');
  assert(await visible(inspector), 'design right inspector marker missing');
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
  const expectedSectionOrder = [
    'ide-design-palette-section-logic',
    'ide-design-palette-section-sequential',
    'ide-design-palette-section-io',
    'ide-design-palette-section-reusable',
    'ide-design-palette-section-board',
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
    canvasOffsetY <= 220,
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

  await searchBox.fill('led');
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-board-output-ld0"]').first()),
    'led search should surface board LED resources'
  );

  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-inspector-empty"]').first()),
    'design inspector should surface an explicit empty-state identity card'
  );

  await triggerClick(modeRoot.locator('[data-testid="ide-design-view-hdl"]').first());
  await page.waitForFunction(() => {
    const workspaceEl = document.querySelector('[data-testid="ide-design-workspace"]');
    return workspaceEl?.getAttribute('data-design-view') === 'hdl';
  }, { timeout: 10000 });

  const codeContextCount = await modeRoot.locator('[data-testid="ide-design-code-context"]').count();
  assert(codeContextCount >= 1, 'code mode context strip missing');
  const artifactSelectorCount = await modeRoot.locator('[data-testid="ide-design-artifact-selector"]').count();
  assert(artifactSelectorCount >= 1, 'artifact selector missing in code mode');

  const leftDockHiddenInCode = await modeRoot.locator('[data-testid="ide-left-dock"]').count();
  assert(leftDockHiddenInCode === 0, 'left dock should be collapsed by default in code mode');
  assert(
    await visible(modeRoot.locator('[data-testid="ide-workbench-dock-toggle-left"]').first()),
    'left dock rail toggle missing in code mode'
  );
  const inspectorHiddenInCode = await modeRoot.locator('[data-testid="ide-inspector"]').count();
  assert(inspectorHiddenInCode === 0, 'inspector should be collapsed by default in code mode');
  assert(
    await visible(modeRoot.locator('[data-testid="ide-workbench-dock-toggle-right"]').first()),
    'right dock rail toggle missing in code mode'
  );

  const secondaryDrawerBefore = await modeRoot.locator('[data-testid="ide-design-secondary-artifact-drawer"]').count();
  assert(secondaryDrawerBefore === 0, 'secondary code artifact should be collapsed by default');

  const [codeWorkspaceBox, leftRailBox, primaryPaneBox, textareaBox] = await Promise.all([
    modeRoot.locator('[data-testid="ide-mode-body"]').first().boundingBox(),
    modeRoot.locator('[data-testid="ide-workbench-dock-toggle-left"]').first().boundingBox(),
    modeRoot.locator('[data-testid="ide-design-primary-artifact-pane"]').first().boundingBox(),
    modeRoot.locator('[data-testid="ide-design-hdl-textarea"]').first().boundingBox(),
  ]);
  assert(
    Boolean(codeWorkspaceBox && leftRailBox && primaryPaneBox && textareaBox),
    'code mode geometry unavailable'
  );
  const leftRailGap = Math.abs(codeWorkspaceBox.x - leftRailBox.x);
  assert(leftRailGap <= 6, `collapsed left rail should not reserve a gutter (gap=${leftRailGap.toFixed(1)})`);
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

  await triggerClick(modeRoot.locator('[data-testid="ide-workbench-dock-toggle-left"]').first());
  assert(
    await visible(modeRoot.locator('[data-testid="ide-left-dock"]').first()),
    'left dock should reopen from left dock rail toggle'
  );
  await triggerClick(modeRoot.locator('[data-testid="ide-workbench-dock-collapse-left"]').first());
  const leftDockCollapsedAgain = await modeRoot.locator('[data-testid="ide-left-dock"]').count();
  assert(leftDockCollapsedAgain === 0, 'left dock collapse action should hide the left dock again');

  await triggerClick(modeRoot.locator('[data-testid="ide-workbench-dock-toggle-right"]').first());
  assert(
    await visible(modeRoot.locator('[data-testid="ide-inspector"]').first()),
    'inspector should reopen from right dock rail toggle'
  );
  await triggerClick(modeRoot.locator('[data-testid="ide-workbench-dock-collapse-right"]').first());
  const inspectorCollapsedAgain = await modeRoot.locator('[data-testid="ide-inspector"]').count();
  assert(inspectorCollapsedAgain === 0, 'inspector collapse action should hide the right dock again');

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
  assert(
    await visible(modeRoot.locator('[data-testid="ide-workbench-dock-toggle-left"]').first()),
    'split mode should keep left dock collapsed behind rail toggle'
  );
  assert(
    await visible(modeRoot.locator('[data-testid="ide-workbench-dock-toggle-right"]').first()),
    'split mode should keep right dock collapsed behind rail toggle'
  );
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-split-compare-tools"]').first()),
    'split mode should expose comparison-focused actions'
  );
  const splitToolSegmentCount = await modeRoot.locator('[data-testid="ide-design-tool-segmented"]').count();
  assert(splitToolSegmentCount === 0, 'split mode should remove the full canvas authoring toolbar');
  const shortcutOverlayCount = await modeRoot.locator('[data-testid="ide-design-shortcut-strip"]').count();
  assert(shortcutOverlayCount === 0, 'split mode should hide the canvas shortcut overlay');
  assert(
    await visible(modeRoot.locator('[data-testid="ide-design-split-stat-tick"]').first()),
    'split mode should keep the compact comparison status row visible'
  );
});
