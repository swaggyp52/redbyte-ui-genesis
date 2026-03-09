#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

function parsePercent(value) {
  const parsed = Number.parseInt((value ?? '').replace('%', '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

await runIdeGate('IDE canvas legibility contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.locator('[data-testid="ide-project-load-start-signal-tour"]').click();
  const confirmVisible = await page
    .locator('[data-testid="ide-example-confirm-modal"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (confirmVisible) {
    await page.locator('[data-testid="ide-example-confirm"]').click();
  }

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const zoomPill = page.locator('[data-testid="ide-design-canvas-stat-zoom"]').first();
  const canvasToggle = page.locator('[data-testid="ide-design-presentation-zoom-toggle-canvas"]').first();
  const toolbarToggle = page.locator('[data-testid="ide-design-presentation-zoom-toggle"]').first();
  const fitButton = page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first();

  assert(await visible(canvas), 'design canvas must be visible');
  assert(await visible(zoomPill), 'design zoom indicator must be visible');
  assert(await visible(fitButton), 'fit button must be visible');
  await fitButton.click();
  const canvasCount = await canvasToggle.count();
  const toolbarCount = await toolbarToggle.count();
  assert(canvasCount + toolbarCount > 0, 'presentation zoom toggle must exist');

  const zoomText = await zoomPill.textContent();
  const zoomValue = parsePercent(zoomText ?? '');
  assert(Number.isFinite(zoomValue), `zoom indicator should be numeric, got "${zoomText ?? ''}"`);
  assert(
    zoomValue >= 60,
    `default zoom should be readable without extreme zoom-out (>=60%), got ${zoomValue}`
  );

  const denseMetrics = await page.evaluate(() => {
    const nodeLabel = document.querySelector('[data-node-id] [data-node-label="1"]');
    const labelSize = nodeLabel
      ? Number.parseFloat(nodeLabel.getAttribute('font-size') ?? String(getComputedStyle(nodeLabel).fontSize))
      : 0;

    const pinHitTarget = document.querySelector('[data-node-id] [data-port-id]');
    const pinRect = pinHitTarget ? pinHitTarget.getBoundingClientRect() : null;

    const canvasEl = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const nodes = Array.from(document.querySelectorAll('[data-node-id]'));
    if (!canvasEl || nodes.length === 0) {
      return { labelSize, pinTarget: 0, widthRatio: 0, heightRatio: 0 };
    }

    const canvasRect = canvasEl.getBoundingClientRect();
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    }

    return {
      labelSize,
      pinTarget: pinRect ? Math.min(pinRect.width, pinRect.height) : 0,
      widthRatio: Math.max(1, maxX - minX) / Math.max(1, canvasRect.width),
      heightRatio: Math.max(1, maxY - minY) / Math.max(1, canvasRect.height),
    };
  });

  assert(
    denseMetrics.labelSize >= 11,
    `node label font should be readable (>=11), got ${denseMetrics.labelSize}`
  );
  assert(
    denseMetrics.pinTarget >= 10,
    `pin hit target should be usable (>=10px min), got ${denseMetrics.pinTarget}`
  );
  assert(
    denseMetrics.widthRatio <= 1.08 && denseMetrics.heightRatio <= 1.08,
    `circuit should fit viewport reasonably (width=${denseMetrics.widthRatio.toFixed(3)}, height=${denseMetrics.heightRatio.toFixed(3)})`
  );

  if (canvasCount > 0) {
    const canvasVisible = await visible(canvasToggle);
    if (canvasVisible) {
      await canvasToggle.click();
    } else {
      await canvasToggle.evaluate((element) => {
        if (element instanceof HTMLElement) element.click();
      });
    }
  } else {
    const toolbarVisible = await visible(toolbarToggle);
    if (toolbarVisible) {
      await toolbarToggle.click();
    } else {
      await toolbarToggle.evaluate((element) => {
        if (element instanceof HTMLElement) element.click();
      });
    }
  }
  const classroomMetrics = await page.evaluate(() => {
    const nodeLabel = document.querySelector('[data-node-id] [data-node-label="1"]');
    const labelSize = nodeLabel
      ? Number.parseFloat(nodeLabel.getAttribute('font-size') ?? String(getComputedStyle(nodeLabel).fontSize))
      : 0;
    const mode = document
      .querySelector('[data-testid="ide-design-live-canvas"]')
      ?.getAttribute('data-presentation-zoom');
    return { labelSize, mode: mode ?? '' };
  });

  assert(
    classroomMetrics.mode === 'classroom',
    `presentation zoom should switch to classroom mode, got "${classroomMetrics.mode}"`
  );
  assert(
    classroomMetrics.labelSize >= denseMetrics.labelSize,
    `classroom mode should not reduce label size (dense=${denseMetrics.labelSize}, classroom=${classroomMetrics.labelSize})`
  );
});

