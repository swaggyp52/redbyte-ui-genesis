#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE authoring depth and release safety satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runAuthoringDepthPath(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Authoring depth browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Authoring depth failures:\n${failures.join('\n')}`);
});

async function runAuthoringDepthPath(page, baseUrl, viewport) {
  await resetStorage(page, baseUrl);
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=authoring-depth-release-safety-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${viewport.label}/Project first launch`);
  await assertTopbarRename(page, viewport);

  await clickVisible(page, '[data-testid="ide-project-build-fresh-primary"]', `${viewport.label}: Build Fresh`);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${viewport.label}/Design blank`);

  assert(await isVisible(page, '[data-testid="ide-design-empty-add-io"]'), `${viewport.label}: blank canvas must expose Add boundary I/O`);
  assert(await isVisible(page, '[data-testid="ide-design-empty-add-and"]'), `${viewport.label}: blank canvas must expose a starter gate path`);
  await clickVisible(page, '[data-testid="ide-design-empty-add-io"]', `${viewport.label}: Add boundary I/O`);
  await waitForRuntimeNodes(page, 2, `${viewport.label}: Add boundary I/O`);

  await assertPartialBlankAuthoring(page, viewport);
  await clickVisible(page, '[data-testid="ide-design-quick-add-and"], [data-testid="ide-design-status-add-and"]', `${viewport.label}: quick Add AND`);
  await waitForRuntimeNodes(page, 3, `${viewport.label}: Add AND after boundary I/O`);
  await assertPartialBlankAuthoring(page, viewport, { expectAnd: true });

  await clickVisible(page, '[data-testid="ide-design-quick-wire"], [data-testid="ide-design-tool-wire"]', `${viewport.label}: Wire tool`);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'wire',
    undefined,
    { timeout: 5000 }
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${viewport.label}/Design reload`);
  await assertPartialBlankAuthoring(page, viewport, { expectAnd: true });
  await clickVisible(page, '[data-testid="ide-design-command-strip-primary-cta"]', `${viewport.label}: Open Verify from Design`);
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.locator('[data-testid="mode-button-design"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  await openMode(page, baseUrl, 'project', `authoring-depth-release-safety-${viewport.label}`);
  await assertProjectContinuity(page, viewport);

  await clickVisible(page, '[data-testid="ide-project-path-course-starter"]', `${viewport.label}: Course Starter path`);
  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${viewport.label}/Design starter`);
  await assertStarterDesignLoop(page, viewport);

  await openMode(page, baseUrl, 'verify', `authoring-depth-release-safety-${viewport.label}`);
  await assertVerifyAfterDesignEdit(page, viewport);

  for (const mode of ['hardware', 'export', 'import']) {
    await openMode(page, baseUrl, mode, `authoring-depth-release-safety-${viewport.label}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
    await assertSurfaceSafe(page, `${viewport.label}/${mode} reload`);
  }
}

async function resetStorage(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=authoring-depth-storage-reset`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function assertSurfaceSafe(page, label) {
  await assertBuildHash(page, label);
  await assertNoRootOverflow(page, label);
  const state = await page.evaluate(() => ({
    hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
    boundaryText: document.querySelector('[data-testid="error-boundary-fallback"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    loadingText: document.querySelector('[data-testid="ide-surface-loading"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    rootText: document.body.textContent?.replace(/\s+/g, ' ').slice(0, 2000) ?? '',
  }));
  assert(!state.hasBoundary, `${label}: workspace error boundary visible: ${state.boundaryText}`);
  assert(!/workspace encountered an error|loading failed|dynamic import/i.test(state.rootText), `${label}: stop-ship workspace load text visible`);
}

async function assertTopbarRename(page, viewport) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await title.isVisible().catch(() => false), `${viewport.label}: topbar project title label must be visible`);
  await title.dblclick({ force: true });
  await page.waitForTimeout(150);
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  assert(await input.isVisible().catch(() => false), `${viewport.label}: double-clicking project title must open rename input`);
  await input.press('Escape').catch(() => null);
}

async function assertPartialBlankAuthoring(page, viewport, options = {}) {
  await assertSurfaceSafe(page, `${viewport.label}/Design partial authoring`);
  const metrics = await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const nodes = runtime?.circuit?.nodes ?? [];
    const connections = runtime?.circuit?.connections ?? [];
    const hasAnd = nodes.some((node) => String(node.type).toUpperCase() === 'AND');
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        top: Math.round(box.top),
        left: Math.round(box.left),
        width: Math.round(box.width),
        height: Math.round(box.height),
        visibleWidth: Math.round(Math.max(0, Math.min(window.innerWidth, box.right) - Math.max(0, box.left))),
        visibleHeight: Math.round(Math.max(0, Math.min(window.innerHeight, box.bottom) - Math.max(0, box.top))),
      };
    };
    return {
      nodeCount: nodes.length,
      connectionCount: connections.length,
      hasAnd,
      quickstrip: rect('[data-testid="ide-design-authoring-quickstrip"]'),
      quickAddAndVisible: Boolean(document.querySelector('[data-testid="ide-design-quick-add-and"]')),
      quickWireVisible: Boolean(document.querySelector('[data-testid="ide-design-quick-wire"]')),
      quickVerifyVisible: Boolean(document.querySelector('[data-testid="ide-design-command-strip-primary-cta"]')),
      statusAddAndVisible: Boolean(document.querySelector('[data-testid="ide-design-status-add-and"]')),
      canvas: rect('[data-testid="ide-design-live-canvas"]'),
    };
  });
  assert(metrics.nodeCount >= 2, `${viewport.label}: partial blank authoring should keep boundary nodes ${JSON.stringify(metrics)}`);
  assert(
    metrics.quickstrip?.visibleWidth >= 360 && metrics.quickstrip?.visibleHeight >= 38,
    `${viewport.label}: partial blank authoring quickstrip missing/unusable ${JSON.stringify(metrics.quickstrip)}`
  );
  assert(metrics.quickAddAndVisible || metrics.statusAddAndVisible, `${viewport.label}: no direct Add AND path after boundary I/O`);
  assert(metrics.quickWireVisible, `${viewport.label}: no direct Wire tool path after boundary I/O`);
  assert(metrics.quickVerifyVisible, `${viewport.label}: no direct Verify continuation path after boundary I/O`);
  assert(metrics.canvas?.visibleWidth >= 620, `${viewport.label}: quickstrip must not steal the canvas ${JSON.stringify(metrics.canvas)}`);
  if (options.expectAnd) {
    assert(metrics.hasAnd, `${viewport.label}: direct Add AND did not create an AND node ${JSON.stringify(metrics)}`);
  }
}

async function assertProjectContinuity(page, viewport) {
  await assertSurfaceSafe(page, `${viewport.label}/Project after blank authoring`);
  const changeProject = page.locator('[data-testid="ide-project-change-project"]').first();
  assert(await changeProject.isVisible().catch(() => false), `${viewport.label}: Project must expose Change Project`);
  await changeProject.click();
  await page.locator('[data-testid="ide-project-entry-paths"]').first().waitFor({ state: 'visible', timeout: 10000 });
  const state = await page.evaluate(() => ({
    hasDirectDesign: Boolean(document.querySelector('[data-testid="ide-project-command-action-design"]')),
    hasDirectVerify: Boolean(document.querySelector('[data-testid="ide-project-command-action-verify"]')),
    hasDirectMap: Boolean(document.querySelector('[data-testid="mode-button-hardware"]')),
    hasDirectExport: Boolean(document.querySelector('[data-testid="mode-button-export"]')),
    hasBuildFresh: Boolean(document.querySelector('[data-testid="ide-project-path-build-fresh"]')),
    hasCourseStarter: Boolean(document.querySelector('[data-testid="ide-project-path-course-starter"]')),
    hasContinue: Boolean(document.querySelector('[data-testid="ide-project-command-strip-primary-cta"]')),
    nextStep: document.querySelector('[data-testid="ide-project-command-strip-next-step-copy"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  }));
  assert(state.hasDirectDesign && state.hasDirectVerify && state.hasDirectMap && state.hasDirectExport, `${viewport.label}: Project lost direct five-stage continuity ${JSON.stringify(state)}`);
  assert(state.hasBuildFresh && state.hasCourseStarter && state.hasContinue, `${viewport.label}: Project lost repeated-use start paths ${JSON.stringify(state)}`);
}

async function assertStarterDesignLoop(page, viewport) {
  await assertSurfaceSafe(page, `${viewport.label}/Design starter authoring loop`);
  await revealDock(page, 'left');
  const before = await readCircuitCounts(page);
  assert(before.nodes >= 6 && before.connections >= 4, `${viewport.label}: Half Adder starter did not load ${JSON.stringify(before)}`);
  assert(await isVisible(page, '[data-testid="ide-design-dock-palette"]'), `${viewport.label}: Design library must be restorable`);
  assert(await isVisible(page, '[data-testid="ide-design-palette-and"]'), `${viewport.label}: Design library must expose logic gates`);

  await selectFirstNode(page);
  assert(await isVisible(page, '[data-testid="ide-design-selection-inspector"]'), `${viewport.label}: selecting a node must open inspector`);
  await clickVisible(page, '[data-testid="ide-design-duplicate-btn"]', `${viewport.label}: duplicate node`);
  await waitForRuntimeNodes(page, before.nodes + 1, `${viewport.label}: duplicate node`);
  await clickVisible(page, '[data-testid="ide-design-inspector-delete"]', `${viewport.label}: delete duplicate`);
  await waitForRuntimeNodes(page, before.nodes, `${viewport.label}: delete duplicate`);
  await clickVisible(page, '[data-testid="ide-design-tool-undo"]', `${viewport.label}: undo duplicate deletion`);
  await waitForRuntimeNodes(page, before.nodes + 1, `${viewport.label}: undo duplicate deletion`);

  await selectFirstWire(page);
  assert(await readSelectedWireCount(page) >= 1, `${viewport.label}: selecting a wire must update selection state`);
  await clickVisible(page, '[data-testid="ide-design-tools-toggle"]', `${viewport.label}: open More tools`);
  await clickVisible(page, '[data-testid="ide-design-tool-delete"]', `${viewport.label}: delete selected wire`);
  await waitForFunctionLabeled(page,
    (minimumConnections) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) < minimumConnections,
    before.connections,
    `${viewport.label}: deleting selected wire`
  );
  await clickVisible(page, '[data-testid="ide-design-tool-undo"]', `${viewport.label}: undo wire deletion`);
  await waitForFunctionLabeled(page,
    (minimumConnections) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) >= minimumConnections,
    before.connections,
    `${viewport.label}: undoing selected wire deletion`
  );
}

async function assertVerifyAfterDesignEdit(page, viewport) {
  await assertSurfaceSafe(page, `${viewport.label}/Verify after Design edit`);
  const pre = await page.evaluate(() => ({
    mode: document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-workspace-mode') ?? '',
    phase: document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-verify-workflow-phase') ?? '',
    runVisible: Boolean(document.querySelector('[data-testid="ide-vcb-run"]')),
    stimulusVisible: Boolean(document.querySelector('[data-testid="ide-verify-region-stimulus"]')),
  }));
  assert(pre.runVisible && pre.stimulusVisible, `${viewport.label}: Verify must remain usable after Design edit ${JSON.stringify(pre)}`);
  await ensureVerifyVectorsReady(page);
  await setVerifyRunMode(page, 'compare');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 }).catch(() => null);
  await assertSurfaceSafe(page, `${viewport.label}/Verify post-run after Design edit`);
}

async function clickVisible(page, selector, label) {
  const target = page.locator(selector).first();
  assert(await target.isVisible().catch(() => false), `${label}: ${selector} was not visible`);
  await target.click({ force: true });
}

async function isVisible(page, selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function waitForRuntimeNodes(page, minimum, label) {
  await waitForFunctionLabeled(page,
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes?.length ?? 0) >= count,
    minimum,
    label
  );
  const count = (await readCircuitCounts(page)).nodes;
  assert(count >= minimum, `${label}: expected at least ${minimum} nodes, got ${count}`);
}

async function waitForFunctionLabeled(page, predicate, arg, label, timeout = 10000) {
  try {
    await page.waitForFunction(predicate, arg, { timeout });
  } catch (error) {
    throw new Error(`${label}: timed out waiting for browser state (${error instanceof Error ? error.message : String(error)})`);
  }
}

async function readCircuitCounts(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
    return {
      nodes: circuit?.nodes?.length ?? 0,
      connections: circuit?.connections?.length ?? 0,
    };
  });
}

async function readSelectedWireCount(page) {
  return page.evaluate(() => {
    const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection;
    return selection?.wires instanceof Set ? selection.wires.size : 0;
  });
}

async function revealDock(page, side) {
  const dockSelector = side === 'left' ? '[data-testid="ide-left-dock"]' : '[data-testid="ide-inspector"]';
  if (await page.locator(dockSelector).first().isVisible().catch(() => false)) return;
  const toggleSelector =
    side === 'left' ? '[data-testid="ide-workbench-dock-toggle-left"]' : '[data-testid="ide-workbench-dock-toggle-right"]';
  await clickVisible(page, toggleSelector, `show ${side} dock`);
  await page.waitForSelector(dockSelector, { timeout: 5000 });
}

async function selectFirstNode(page) {
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) return null;
    const node = Array.from(document.querySelectorAll('[data-node-id]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4 && rect.right > canvasRect.left && rect.left < canvasRect.right;
    });
    const nodeId = node?.getAttribute('data-node-id') ?? null;
    if (nodeId) {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectMultipleNodes?.([nodeId], false);
    }
    return nodeId;
  });
  assert(Boolean(selected), 'expected a visible node to select');
  await page.waitForTimeout(150);
}

async function selectFirstWire(page) {
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) return null;
    const wire = Array.from(document.querySelectorAll('[data-wire-id]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && rect.right > canvasRect.left && rect.left < canvasRect.right;
    });
    const wireId = wire?.getAttribute('data-wire-id') ?? null;
    if (wireId) {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.clearSelection?.();
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectWire?.(wireId, false);
    }
    return wireId;
  });
  assert(Boolean(selected), 'expected a visible wire to select');
  await page.waitForTimeout(150);
}
