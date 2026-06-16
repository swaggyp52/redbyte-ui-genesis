#!/usr/bin/env node

/**
 * Hardware / Basys3 workbench gate.
 *
 * Contract:
 * 1) Map Pins presents a Basys3 workbench at 1366x768 and 1440x900.
 * 2) A selected row exposes the full signal -> board resource -> package pin -> XDC consequence chain.
 * 3) Mapping Complete remains E0/browser evidence only after Verify Compare PASS and Export are current.
 * 4) Hardware never claims Vivado build, bitstream programming, or physical board observation proof.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_DIR = process.env.RB_HARDWARE_BASYS3_WORKBENCH_SCREENSHOTS_DIR?.trim() || '';

await runIdeGate('IDE hardware Basys3 workbench satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const viewportFailures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openStarterHardware(page, baseUrl, 'logic-gates', viewport.name);
      await captureScreenshot(page, `map-${viewport.name}`);
      await assertMapWorkbench(page, viewport.name);
      await assertSelectedBindingChain(page, viewport.name);
      await captureScreenshot(page, `map-${viewport.name}`);
      await assertNoRootHorizontalOverflow(page, `Hardware Map Pins ${viewport.name}`);
    } catch (error) {
      viewportFailures.push(`${viewport.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (viewportFailures.length > 0) {
    throw new Error(viewportFailures.join('\n'));
  }

  await assertReadyStateBoundary(page, baseUrl);
});

async function openStarterHardware(page, baseUrl, starterId, viewportName) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=hardware-basys3-workbench-${viewportName}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: starterId });
  await openHardware(page);
}

async function openHardware(page) {
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });
}

async function openVerify(page) {
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function openExport(page) {
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-export-handoff-station"]', { timeout: 15000 });
}

async function assertMapWorkbench(page, viewportName) {
  const workspace = page.locator('[data-testid="ide-hw-board-workspace"]').first();
  const summary = page.locator('[data-testid="ide-hw-board-resource-summary"]').first();
  const table = page.locator('[data-testid="ide-hw-map-table"]').first();
  const board = page.locator('[data-testid="ide-hw-map-board"]').first();
  const row = page.locator('[data-testid="ide-hw-map-row-sw0"]').first();

  const mapRail = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  assert(await visible(mapRail), `${viewportName} Map Pins restore rail must be visible on entry`);
  const railText = await normalizedText(mapRail);
  assert(/show/i.test(railText) && /map/i.test(railText), `${viewportName} Map Pins rail must clearly restore map support, got "${railText}"`);
  await mapRail.click();
  assert(await visible(page.locator('[data-testid="ide-hw-map-dock"]').first()), `${viewportName} Map Pins dock must open from the restore rail`);
  assert(await visible(workspace), `${viewportName} board workspace must be visible`);
  assert(await visible(summary), `${viewportName} Basys3 resource summary must be visible`);
  assert(await visible(table), `${viewportName} mapping table must be visible`);
  assert(await visible(board), `${viewportName} Basys3 board must be visible`);
  assert(await visible(row), `${viewportName} SW0 mapping row must be visible`);
  await assertVisibleInViewport(page, workspace, `${viewportName} board workspace`, { minVisibleAreaRatio: 0.55 });
  await assertVisibleInViewport(page, table, `${viewportName} mapping table`, { minVisibleHeight: 220, minVisibleAreaRatio: 0.55 });
  await assertVisibleInViewport(page, board, `${viewportName} Basys3 board`, { minVisibleHeight: 220, minVisibleAreaRatio: 0.55 });
}

async function assertSelectedBindingChain(page, viewportName) {
  await page.locator('[data-testid="ide-hw-map-row-sw0"]').click();
  const chain = page.locator('[data-testid="ide-hardware-basys3-binding-chain"]').first();
  assert(await visible(chain), `${viewportName} selected row must expose the Basys3 binding chain`);
  await assertVisibleInViewport(page, chain, `${viewportName} selected binding chain`, {
    minVisibleHeight: 44,
    minVisibleAreaRatio: 0.9,
  });

  const text = await normalizedText(chain);
  assert(/SW0/i.test(text), `${viewportName} binding chain must include the project signal and board resource, got "${text}"`);
  assert(/V17/i.test(text), `${viewportName} binding chain must include package pin V17, got "${text}"`);
  assert(/PACKAGE_PIN\s+V17/i.test(text), `${viewportName} binding chain must show the XDC PACKAGE_PIN consequence, got "${text}"`);
  assert(/get_ports/i.test(text), `${viewportName} binding chain must show the XDC get_ports consequence, got "${text}"`);
}

async function assertReadyStateBoundary(page, baseUrl) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openStarterHardware(page, baseUrl, 'logic-gates', 'ready');

  await openVerify(page);
  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), 'Hardware ready boundary requires Verify Compare mode');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const verifyStatus = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(verifyStatus), `Hardware ready boundary requires current Compare PASS, got "${verifyStatus}"`);

  await openExport(page);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('[data-testid="ide-export-rebuild-btn"]').first().click(),
  ]);
  const downloadFailure = await download.failure();
  assert(!downloadFailure, `current export package download failed: ${downloadFailure}`);
  await page.waitForSelector('[data-testid="ide-export-download-success"]', { timeout: 10000 });

  await openHardware(page);
  await captureScreenshot(page, 'ready-1366x768');

  const hardware = page.locator('[data-testid="ide-mode-hardware"]').first();
  const commandStrip = page.locator('[data-testid="ide-hardware-command-strip"]').first();
  const terminalStep = page.locator('.ide-hardware-dep-step--terminal').first();
  const callout = page.locator('[data-testid="ide-hardware-readiness-callout"]').first();

  const hardwareText = await normalizedText(hardware);
  const commandText = await normalizedText(commandStrip);
  const terminalText = await normalizedText(terminalStep);
  const calloutText = await normalizedText(callout);

  assert(/MAPPING COMPLETE/i.test(hardwareText), 'Hardware should show mapping complete after current Verify and Export');
  assert(/E0/i.test(commandText), `ready command strip must identify E0/browser evidence, got "${commandText}"`);
  assert(/E1\/E2\/E3|E1.*E2.*E3/i.test(commandText), `ready command strip must keep E1/E2/E3 external, got "${commandText}"`);
  assert(/not prove|not proven/i.test(commandText), `ready command strip must avoid hardware-proof overclaim, got "${commandText}"`);
  assert(/external|pending|Vivado/i.test(terminalText), `program terminal step must remain external/pending, got "${terminalText}"`);
  assert(!/In Vivado|ready for the Basys3|Continue to Program Handoff/i.test(hardwareText), 'Hardware ready state must not claim Vivado or program handoff success');
  assert(!/Vivado build passed|bitstream programmed|board observed/i.test(calloutText), `Hardware callout must not claim E1/E2/E3 proof, got "${calloutText}"`);
  await assertNoRootHorizontalOverflow(page, 'Hardware ready boundary');
}

async function captureScreenshot(page, label) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `hardware-basys3-workbench-${safeLabel}.png`),
    fullPage: true,
  });
}

async function assertVisibleInViewport(page, locator, label, options = {}) {
  const box = await locator.first().boundingBox();
  assert(box, `${label} must have a measurable layout box`);
  const viewport = page.viewportSize();
  assert(viewport, `${label} requires a viewport`);

  const visibleLeft = Math.max(0, box.x);
  const visibleRight = Math.min(viewport.width, box.x + box.width);
  const visibleTop = Math.max(0, box.y);
  const visibleBottom = Math.min(viewport.height, box.y + box.height);
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const visibleAreaRatio = (visibleWidth * visibleHeight) / Math.max(1, box.width * box.height);

  const minVisibleWidth = options.minVisibleWidth ?? 80;
  const minVisibleHeight = options.minVisibleHeight ?? 48;
  const minVisibleAreaRatio = options.minVisibleAreaRatio ?? 0.65;
  assert(visibleWidth >= minVisibleWidth, `${label} visible width ${visibleWidth.toFixed(1)} < ${minVisibleWidth}`);
  assert(visibleHeight >= minVisibleHeight, `${label} visible height ${visibleHeight.toFixed(1)} < ${minVisibleHeight}`);
  assert(
    visibleAreaRatio >= minVisibleAreaRatio,
    `${label} visible area ratio ${visibleAreaRatio.toFixed(2)} < ${minVisibleAreaRatio}`
  );
}

async function assertNoRootHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const overflow = Math.max(metrics.docScrollWidth, metrics.bodyScrollWidth) - metrics.viewportWidth;
  assert(overflow <= 1, `${label} must not create root horizontal overflow, overflow=${overflow}`);
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
