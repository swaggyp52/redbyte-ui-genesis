#!/usr/bin/env node

/**
 * Hardware first-viewport hierarchy gate.
 *
 * Contract:
 * 1) The visible build badge matches the current Git SHA.
 * 2) Hardware opens the Logic Gates starter in Map Pins at classroom and desktop sizes.
 * 3) The Basys3 board/table and selected signal -> board -> pin -> XDC chain are first-viewport content.
 * 4) This is presentation-only proof: no pin mapping, generated artifact, or E1/E2/E3 hardware proof changes.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();

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

      const buildSha = (await page.locator('.ide-build-badge-sha').first().textContent().catch(() => ''))?.trim() ?? '';
      assert(
        buildSha === CURRENT_SHA,
        `${viewport.label}: visible build sha must match current git sha ${CURRENT_SHA}, got ${buildSha || 'missing'}`
      );

      const row = page.locator('[data-testid="ide-hw-map-row-sw0"]').first();
      assert(await visible(row), `${viewport.label}: SW0 row must be visible before selection`);
      await row.click();
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
      observations.push({ viewport: viewport.label, ...observation });
      await capture(page, viewport.label);

      assert(observation.mode === 'hardware', `${viewport.label}: expected Hardware mode, got ${observation.mode}`);
      assert(observation.overflowX <= 1, `${viewport.label}: Hardware must not create root overflow`);
      assert(
        observation.boardWorkspace.top <= 145,
        `${viewport.label}: board workspace starts too low (${observation.boardWorkspace.top.toFixed(1)}px)`
      );
      assert(
        observation.table.top <= 190,
        `${viewport.label}: mapping table starts too low (${observation.table.top.toFixed(1)}px)`
      );
      assert(
        observation.board.top <= 190,
        `${viewport.label}: Basys3 board starts too low (${observation.board.top.toFixed(1)}px)`
      );
      assert(
        observation.table.visibleHeight >= 200,
        `${viewport.label}: mapping table visible height ${observation.table.visibleHeight.toFixed(1)}px < 200px`
      );
      assert(
        observation.board.visibleHeight >= 200,
        `${viewport.label}: Basys3 board visible height ${observation.board.visibleHeight.toFixed(1)}px < 200px`
      );
      assert(
        observation.bindingChain.visibleHeight >= 44,
        `${viewport.label}: selected binding chain must remain visible in the first viewport`
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
  const mapTab = page.locator('[data-testid="ide-hw-mode-btn-map"]').first();
  await mapTab.waitFor({ state: 'attached', timeout: 15000 });
  if ((await mapTab.getAttribute('aria-selected').catch(() => 'false')) !== 'true') {
    await mapTab.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('expected Hardware Map Pins tab to be an HTMLElement');
      }
      element.click();
    });
  }
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="ide-hw-mode-btn-map"]')?.getAttribute('aria-selected') === 'true' &&
      document.querySelector('[data-testid="ide-hw-board-workspace"]')?.classList.contains('ide-hw-board-workspace--map'),
    { timeout: 15000 }
  );
  await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });
}

async function waitForHardwareFirstViewportLayout(page, viewportLabel) {
  await page.waitForFunction(
    () => {
      const workspace = document.querySelector('[data-testid="ide-hw-board-workspace"]');
      const board = document.querySelector('[data-testid="ide-hw-map-board"]');
      const table = document.querySelector('[data-testid="ide-hw-map-table"]');
      const mode = document.querySelector('[data-ide-mode-marker]');
      const proofRibbonHeight = getComputedStyle(document.documentElement)
        .getPropertyValue('--ide-proof-ribbon-height')
        .trim();
      if (!workspace || !board || !table || !mode) return false;
      if (mode.getAttribute('data-ide-mode-marker') !== 'hardware') return false;
      if (!workspace.classList.contains('ide-hw-board-workspace--map')) return false;
      if (proofRibbonHeight !== '40px') return false;

      const workspaceRect = workspace.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      return workspaceRect.top <= 145 && boardRect.top <= 190 && tableRect.top <= 190;
    },
    { timeout: 15000 },
  ).catch(async () => {
    const state = await readHardwareFirstViewportState(page);
    throw new Error(
      `${viewportLabel}: Hardware Map Pins layout did not settle into first-viewport contract ` +
        `(workspace ${state.boardWorkspace.top.toFixed(1)}px, board ${state.board.top.toFixed(1)}px, table ${state.table.top.toFixed(1)}px)`
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
