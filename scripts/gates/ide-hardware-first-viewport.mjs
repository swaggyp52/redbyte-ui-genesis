#!/usr/bin/env node

/**
 * Hardware first-viewport hierarchy gate.
 *
 * Contract:
 * 1) The shell build identity matches the current Git SHA.
 * 2) Hardware opens the Logic Gates starter directly in Map Pins at classroom and desktop sizes.
 * 3) Progress and the selected-mapping editor lead the guided task; the mapping table remains visible below them.
 * 4) The Basys3 board starts as a secondary reference beside the table and stays reachable below an expanded editor.
 * 5) The selected signal -> board -> pin -> XDC chain remains first-viewport content.
 * 6) This is presentation-only proof: no pin mapping, generated artifact, or E1/E2/E3 hardware proof changes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_DIR = process.env.RB_HARDWARE_FIRST_VIEWPORT_SCREENSHOTS_DIR?.trim() || '';

await runIdeGate('IDE hardware first viewport hierarchy satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];
  const observations = [];

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openStarterHardware(page, baseUrl, viewport.label);
      await assertBuildHash(page, viewport.label);

      const entryObservation = await readHardwareFirstViewportState(page);
      observations.push({ viewport: viewport.label, phase: 'entry', ...entryObservation });
      assert(
        entryObservation.board.top <= 560 && entryObservation.board.visibleHeight >= 150,
        `${viewport.label}: Basys3 board reference must be visible before a signal editor expands ${JSON.stringify(entryObservation.board)}`
      );

      const row = page.locator('[data-testid="ide-hw-map-row-sw0"]').first();
      assert(await visible(row), `${viewport.label}: SW0 row must be visible before selection`);
      await row.click();
      await resetHardwareFirstViewportScroll(page);
      await waitForHardwareFirstViewportLayout(page, viewport.label).catch(async (error) => {
        observations.push({
          viewport: viewport.label,
          settleFailure: true,
          ...(await readHardwareFirstViewportState(page)),
        });
        await capture(page, `${viewport.label}-settle-failure`);
        throw error;
      });

      const observation = await readHardwareFirstViewportState(page);
      observations.push({ viewport: viewport.label, phase: 'selected', ...observation });
      await capture(page, viewport.label);

      assert(observation.mode === 'hardware', `${viewport.label}: expected Hardware mode, got ${observation.mode}`);
      assert(observation.mapWorkspaceActive, `${viewport.label}: Hardware must open directly in Map Pins`);
      assert(observation.overflowX <= 1, `${viewport.label}: Hardware must not create root overflow`);
      assert(
        observation.boardWorkspace.top <= 200,
        `${viewport.label}: Map Pins workspace starts too low (${observation.boardWorkspace.top.toFixed(1)}px)`
      );
      assert(
        observation.table.top <= 560,
        `${viewport.label}: mapping table starts too low (${observation.table.top.toFixed(1)}px)`
      );
      assert(
        observation.table.visibleHeight >= 200,
        `${viewport.label}: mapping table visible height ${observation.table.visibleHeight.toFixed(1)}px < 200px`
      );
      assert(
        observation.table.visibleWidth >= observation.board.visibleWidth,
        `${viewport.label}: mapping table must remain the primary work object ${JSON.stringify({ table: observation.table, board: observation.board })}`
      );
      assert(
        observation.board.visibleWidth >= 250,
        `${viewport.label}: Basys3 board reference must remain proportionally visible ${JSON.stringify(observation.board)}`
      );
      assert(
        observation.bindingChain.visibleHeight >= 44,
        `${viewport.label}: selected binding chain must remain visible in the first viewport`
      );

      await page.locator('[data-testid="ide-hw-map-board"]').first().scrollIntoViewIfNeeded();
      const scrolledObservation = await readHardwareFirstViewportState(page);
      assert(
        scrolledObservation.board.visibleHeight >= 150,
        `${viewport.label}: expanded mapping editor must leave the secondary board reference reachable ${JSON.stringify(scrolledObservation.board)}`
      );

      const bodyText = await normalizedText(page.locator('[data-testid="ide-mode-hardware"]').first());
      assert(/SW0/i.test(bodyText), `${viewport.label}: Hardware must still expose SW0 mapping text`);
      assert(/PACKAGE_PIN\s+V17/i.test(bodyText), `${viewport.label}: Hardware must still expose XDC consequence text`);
      assert(
        !/Vivado build passed|bitstream programmed|board observed/i.test(bodyText),
        `${viewport.label}: Hardware browser view must not claim E1/E2/E3 proof`
      );
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeObservations(observations);
  assert(failures.length === 0, `Hardware first-viewport hierarchy failures:\n${failures.join('\n')}`);
});

async function openStarterHardware(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=hardware-first-viewport-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-hardware"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForSelector('[data-testid="ide-hw-board-workspace"].ide-hw-v3', {
    state: 'visible',
    timeout: 15000,
  });
  assert(
    (await page.locator('[data-testid="ide-hw-stage-rail"]:visible').count()) === 0,
    `${viewportLabel}: after-mapping stage rail must not replace the default Map Pins workbench`
  );
  await resetHardwareFirstViewportScroll(page);
}

async function resetHardwareFirstViewportScroll(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const scrollContainers = [
      document.scrollingElement,
      document.querySelector('.ide-workbench-workspace'),
      document.querySelector('[data-testid="ide-hardware-panel"] .ide-panel-body'),
      document.querySelector('[data-testid="ide-mode-hardware"]'),
    ].filter(Boolean);

    for (const element of scrollContainers) {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
  });
}

async function waitForHardwareFirstViewportLayout(page, viewportLabel) {
  await page.waitForFunction(
    () => {
      const workspace = document.querySelector('[data-testid="ide-hw-board-workspace"]');
      const table = document.querySelector('[data-testid="ide-hw-map-table"]');
      const mode = document.querySelector('[data-ide-mode-marker]');
      const chain = document.querySelector('[data-testid="ide-hardware-basys3-binding-chain"]');
      if (!workspace || !table || !chain || !mode) return false;
      if (mode.getAttribute('data-ide-mode-marker') !== 'hardware') return false;
      if (!workspace.classList.contains('ide-hw-v3')) return false;

      const workspaceRect = workspace.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const chainRect = chain.getBoundingClientRect();
      const chainVisibleHeight = Math.max(0, Math.min(window.innerHeight, chainRect.bottom) - Math.max(0, chainRect.top));
      return (
        workspaceRect.top <= 200 &&
        tableRect.top <= 560 &&
        tableRect.width >= 620 &&
        chainVisibleHeight >= 44
      );
    },
    { timeout: 15000 },
  ).catch(async () => {
    const state = await readHardwareFirstViewportState(page);
    throw new Error(
      `${viewportLabel}: Hardware Map Pins layout did not settle into first-viewport contract ` +
        `(workspace ${state.boardWorkspace.top.toFixed(1)}px, chain ${state.bindingChain.top.toFixed(1)}px/${state.bindingChain.visibleHeight.toFixed(1)}px visible, ` +
        `table ${state.table.top.toFixed(1)}px/${state.table.width.toFixed(1)}px wide)`
    );
  });
}

async function readHardwareFirstViewportState(page) {
  return page.evaluate(() => {
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return {
          top: Infinity,
          bottom: Infinity,
          width: 0,
          height: 0,
          visibleWidth: 0,
          visibleHeight: 0,
          visible: false,
        };
      }

      const rect = element.getBoundingClientRect();
      const visibleLeft = Math.max(0, rect.left);
      const visibleRight = Math.min(window.innerWidth, rect.right);
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      return {
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        visibleWidth,
        visibleHeight,
        visible: rect.width > 1 && rect.height > 1 && visibleWidth > 1 && visibleHeight > 1,
      };
    };

    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      mapWorkspaceActive:
        document.querySelector('[data-testid="ide-hw-board-workspace"]')?.classList.contains('ide-hw-v3') === true &&
        !Array.from(document.querySelectorAll('[data-testid="ide-hw-stage-rail"]')).some((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
        }),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      boardWorkspace: rectFor('[data-testid="ide-hw-board-workspace"]'),
      table: rectFor('[data-testid="ide-hw-map-table"]'),
      board: rectFor('[data-testid="ide-hw-map-board"]'),
      bindingChain: rectFor('[data-testid="ide-hardware-basys3-binding-chain"]'),
    };
  });
}

async function capture(page, label) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `hardware-first-viewport-${label}.png`),
    fullPage: false,
  });
}

async function writeObservations(observations) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.writeFile(path.join(SCREENSHOT_DIR, 'hardware-first-viewport-observations.json'), JSON.stringify(observations, null, 2));
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
