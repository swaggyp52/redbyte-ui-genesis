#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const VIEWPORT = { label: '1093x614-compact', width: 1093, height: 614 };
const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'release',
  'unified-v3-rc',
  'design-port-target-authority'
);
const TARGET_WIRE_ID = 'sw0_node.out-and_node.a';

await mkdir(ARTIFACT_ROOT, { recursive: true });

await runIdeGate('IDE Design port target authority satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-port-target-authority`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'design port target authority/startup');
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"] [data-node-id]', { timeout: 15000 });

  await clickIfVisible(page, '[data-testid="ide-design-fit-circuit-canvas"]');
  await page.waitForTimeout(180);
  const connectionCountBefore = await readConnectionCount(page);
  assert(connectionCountBefore === 9, `logic-gates starter must begin with 9 connections, got ${connectionCountBefore}`);

  await deleteKnownWire(page, TARGET_WIRE_ID, connectionCountBefore - 1);
  await clickRequired(page, '[data-testid="ide-design-tool-wire"]', 'Wire tool');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'wire',
    undefined,
    { timeout: 5000 }
  );
  await clickIfVisible(page, '[data-testid="ide-design-fit-circuit-canvas"]');
  await page.waitForTimeout(180);

  const geometry = await readTargetGeometry(page);
  assert(geometry.direct.length > 0, 'compact Design must expose direct port targets');
  assert(
    geometry.direct.every((target) => target.width >= 24 && target.height >= 24),
    `every direct target must be at least 24x24: ${JSON.stringify(geometry.direct)}`
  );
  assert(
    geometry.direct.every((target) => target.centerHit),
    `every direct target center must resolve to itself: ${JSON.stringify(geometry.direct)}`
  );
  assert(geometry.clusters.length > 0, 'compact Fit must expose at least one dense port cluster');
  assert(
    geometry.clusters.every((target) => target.width >= 32 && target.height >= 24),
    `every dense cluster must be at least 32x24: ${JSON.stringify(geometry.clusters)}`
  );
  assert(
    geometry.clusters.every((target) => target.centerHit),
    `every dense cluster center must resolve to its cluster: ${JSON.stringify(geometry.clusters)}`
  );
  assert(geometry.wireCue.inWorkspaceHeader, 'Wire guidance must be owned by the Design workspace header');
  assert(!geometry.wireCue.intersectsCanvas, `Wire guidance must not cover the circuit canvas: ${JSON.stringify(geometry.wireCue)}`);
  assert(!geometry.obscuringHudPresent, 'Wire mode must not render the old ide-design-tool-hud canvas overlay');

  const source = page.locator('[data-node-id="sw0_node"] [data-port-id="out"]').first();
  await source.waitFor({ state: 'visible', timeout: 8000 });
  await source.click();
  await page.waitForFunction(
    () => {
      const sourcePort = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort;
      return sourcePort?.nodeId === 'sw0_node' && sourcePort?.portName === 'out';
    },
    undefined,
    { timeout: 5000 }
  );

  const cue = page.locator('[data-testid="ide-design-wire-cue"]').first();
  assert(
    /Source:.*SW0.*out.*compatible inputs are green/i.test((await cue.textContent()) ?? ''),
    `armed Wire cue must name the source and compatible-target color, got "${(await cue.textContent()) ?? ''}"`
  );

  const andInputCluster = page.locator('[data-testid="logic-port-cluster-and_node-input"]').first();
  await andInputCluster.waitFor({ state: 'visible', timeout: 8000 });
  await andInputCluster.click();
  const picker = page.locator('[data-testid="logic-port-picker"]').first();
  await picker.waitFor({ state: 'visible', timeout: 5000 });
  assert((await picker.getAttribute('data-port-picker-side')) === 'input', 'AND cluster must open an input endpoint picker');

  const choiceA = page.locator('[data-testid="logic-port-picker-choice-and_node-a"]').first();
  const choiceB = page.locator('[data-testid="logic-port-picker-choice-and_node-b"]').first();
  await choiceA.waitFor({ state: 'visible', timeout: 5000 });
  await choiceB.waitFor({ state: 'visible', timeout: 5000 });
  assert(await choiceA.isEnabled(), 'deleted AND.a endpoint must be enabled as the compatible destination');
  assert(
    (await choiceA.getAttribute('data-port-choice')) === 'a'
      && (await choiceB.getAttribute('data-port-choice')) === 'b',
    'dense picker must keep adjacent AND.a and AND.b endpoints separately named'
  );
  const pickerChoices = await Promise.all([choiceA, choiceB].map(async (choice) => {
    const box = await choice.boundingBox();
    return {
      testId: await choice.getAttribute('data-testid'),
      enabled: await choice.isEnabled(),
      width: box?.width ?? 0,
      height: box?.height ?? 0,
    };
  }));
  assert(
    pickerChoices.every((choice) => choice.height >= 40),
    `endpoint picker choices must remain distinct 40px rows: ${JSON.stringify(pickerChoices)}`
  );

  const pickerHitGeometry = await page.evaluate(() => {
    const picker = document.querySelector('[data-testid="logic-port-picker"]');
    const hint = picker?.querySelector('.logic-port-picker__hint');
    const choices = picker?.querySelector('.logic-port-picker__choices');
    const choiceA = document.querySelector('[data-testid="logic-port-picker-choice-and_node-a"]');
    const choiceB = document.querySelector('[data-testid="logic-port-picker-choice-and_node-b"]');
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      };
    };
    const choiceRect = choiceA?.getBoundingClientRect();
    const samples = choiceRect
      ? [
          { x: choiceRect.left + 10, y: choiceRect.top + choiceRect.height / 2 },
          { x: choiceRect.left + choiceRect.width / 2, y: choiceRect.top + choiceRect.height / 2 },
          { x: choiceRect.right - 10, y: choiceRect.top + choiceRect.height / 2 },
        ].map((point) => {
          const hit = document.elementFromPoint(point.x, point.y);
          const owner = hit?.closest?.('[data-testid]');
          return {
            x: Number(point.x.toFixed(2)),
            y: Number(point.y.toFixed(2)),
            tag: hit?.tagName ?? null,
            className: typeof hit?.className === 'string' ? hit.className : null,
            ownerTestId: owner?.getAttribute('data-testid') ?? null,
          };
        })
      : [];
    return {
      picker: rectOf(picker),
      hint: rectOf(hint),
      choices: rectOf(choices),
      choiceA: rectOf(choiceA),
      choiceB: rectOf(choiceB),
      samples,
      pickerStyle: picker
        ? {
            display: getComputedStyle(picker).display,
            gridTemplateRows: getComputedStyle(picker).gridTemplateRows,
            overflow: getComputedStyle(picker).overflow,
            pointerEvents: getComputedStyle(picker).pointerEvents,
            position: getComputedStyle(picker).position,
            zIndex: getComputedStyle(picker).zIndex,
          }
        : null,
    };
  });
  assert(
    pickerHitGeometry.samples.every((sample) => sample.ownerTestId === 'logic-port-picker-choice-and_node-a'),
    `AND.a row must own its pointer hit area: ${JSON.stringify(pickerHitGeometry)}`
  );

  await choiceA.click();
  await waitForConnection(page, TARGET_WIRE_ID, connectionCountBefore);
  await picker.waitFor({ state: 'detached', timeout: 5000 });
  assert(
    !(await page.evaluate(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort))),
    'successful dense-picker connection must clear the armed source'
  );

  await assertBuildHash(page, 'design port target authority/final');
  await assertNoRootOverflow(page, 'design port target authority/final');
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, `${VIEWPORT.label}-connected.png`),
    fullPage: false,
    animations: 'disabled',
  });

  const record = {
    gate: 'ide-design-port-target-authority',
    generatedAtIso: new Date().toISOString(),
    viewport: VIEWPORT,
    targetWireId: TARGET_WIRE_ID,
    connectionCountBefore,
    geometry,
    pickerChoices,
    pickerHitGeometry,
    browserProblems,
  };
  await writeFile(
    path.join(ARTIFACT_ROOT, 'ide-design-port-target-authority.json'),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8'
  );
  assert(browserProblems.length === 0, `browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function deleteKnownWire(page, wireId, expectedCount) {
  const wire = page.locator(`[data-wire-id="${wireId}"]`).first();
  await wire.waitFor({ state: 'attached', timeout: 8000 });
  const hitPath = wire.locator('path').first();
  if (await hitPath.isVisible().catch(() => false)) {
    await hitPath.click({ force: true });
  } else {
    await wire.evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await page.waitForFunction(
    (id) => document.querySelector(`[data-wire-id="${id}"]`)?.getAttribute('data-wire-selected') === '1',
    wireId,
    { timeout: 5000 }
  );
  await page.keyboard.press('Delete');
  await page.waitForFunction(
    ({ id, count }) => {
      const connections = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections ?? [];
      return connections.length === count && !connections.some((connection) => connectionId(connection) === id);

      function connectionId(connection) {
        const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        const fromPort = typeof connection.from === 'string'
          ? connection.fromPort ?? connection.fromPin ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out';
        const toPort = typeof connection.to === 'string'
          ? connection.toPort ?? connection.toPin ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in';
        return `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`;
      }
    },
    { id: wireId, count: expectedCount },
    { timeout: 8000 }
  );
}

async function readTargetGeometry(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    const readTargets = (selector, kind) => Array.from(canvas?.querySelectorAll(selector) ?? [])
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const hit = document.elementFromPoint(center.x, center.y);
        const hitOwner = kind === 'cluster'
          ? hit?.closest?.('[data-port-cluster]')
          : hit?.closest?.('[data-port-id]');
        return {
          nodeId: element.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null,
          id: kind === 'cluster'
            ? element.getAttribute('data-port-cluster')
            : element.getAttribute('data-port-id'),
          width: Number(rect.width.toFixed(3)),
          height: Number(rect.height.toFixed(3)),
          inCanvas: canvasRect
            ? center.x >= canvasRect.left && center.x <= canvasRect.right
              && center.y >= canvasRect.top && center.y <= canvasRect.bottom
            : false,
          centerHit: hitOwner === element,
        };
      })
      .filter((target) => target.inCanvas);

    const cue = document.querySelector('[data-testid="ide-design-wire-cuebar"]');
    const cueRect = cue?.getBoundingClientRect();
    const intersectsCanvas = Boolean(cueRect && canvasRect
      && cueRect.left < canvasRect.right
      && cueRect.right > canvasRect.left
      && cueRect.top < canvasRect.bottom
      && cueRect.bottom > canvasRect.top);
    return {
      direct: readTargets('[data-port-id]', 'direct'),
      clusters: readTargets('[data-port-cluster]', 'cluster'),
      wireCue: {
        present: Boolean(cue),
        inWorkspaceHeader: Boolean(cue?.closest('[data-testid="ide-design-workspace-header"]')),
        intersectsCanvas,
        width: cueRect ? Number(cueRect.width.toFixed(3)) : 0,
        height: cueRect ? Number(cueRect.height.toFixed(3)) : 0,
      },
      obscuringHudPresent: Boolean(
        document.querySelector('[data-testid="ide-design-canvas"] [data-testid="ide-design-tool-hud"]')
      ),
    };
  });
}

async function waitForConnection(page, wireId, expectedCount) {
  await page.waitForFunction(
    ({ id, count }) => {
      const connections = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections ?? [];
      return connections.length === count && connections.some((connection) => connectionId(connection) === id);

      function connectionId(connection) {
        const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        const fromPort = typeof connection.from === 'string'
          ? connection.fromPort ?? connection.fromPin ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out';
        const toPort = typeof connection.to === 'string'
          ? connection.toPort ?? connection.toPin ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in';
        return `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`;
      }
    },
    { id: wireId, count: expectedCount },
    { timeout: 8000 }
  );
}

async function readConnectionCount(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0);
}

async function clickRequired(page, selector, label) {
  const target = page.locator(selector).first();
  assert(await target.isVisible().catch(() => false), `${label} must be visible`);
  await target.click();
}

async function clickIfVisible(page, selector) {
  const target = page.locator(selector).first();
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.click();
  return true;
}
