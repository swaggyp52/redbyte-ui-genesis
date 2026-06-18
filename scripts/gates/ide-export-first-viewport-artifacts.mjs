#!/usr/bin/env node

/**
 * Export first-viewport artifact visibility gate.
 *
 * Contract:
 * 1) Ready-to-build Export keeps concrete generated file names visible in the package inspector at 1366x768 and 1440x900.
 * 2) The visible file cue is in the first viewport and names the core E0 artifacts students/professors inspect.
 * 3) The downstream handoff station and artifact explorer remain present; this gate does not change generated files or hardware proof claims.
 */

import { execSync } from 'node:child_process';
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

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const SCREENSHOT_DIR = process.env.RB_EXPORT_FIRST_VIEWPORT_ARTIFACTS_SCREENSHOTS_DIR?.trim() || '';
const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];
const REQUIRED_ARTIFACTS = [
  'README.txt',
  'top.vhd',
  'top.xdc',
  'testbench.vhd',
  'vivado_import.tcl',
];

await runIdeGate('IDE export first-viewport artifacts visible', async ({ page, baseUrl }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const observations = [];
  const failures = [];

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openReadyToBuildExport(page, baseUrl, viewport.label);
      await capture(page, viewport.label);

      const buildSha = (await page.locator('.ide-build-badge-sha').first().textContent().catch(() => ''))?.trim() ?? '';
      assert(
        buildSha === CURRENT_SHA,
        `${viewport.label}: visible build sha must match current git sha ${CURRENT_SHA}, got ${buildSha || 'missing'}`
      );

      const inspector = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
      const fileBrowser = page.locator('[data-testid="ide-export-file-browser-v1"]').first();
      const station = page.locator('[data-testid="ide-export-handoff-station"]').first();
      const artifactStrip = page.locator('[data-testid="ide-export-handoff-artifact-strip"]').first();
      assert(await visible(inspector), `${viewport.label}: Export package inspector must be visible`);
      assert(await visible(fileBrowser), `${viewport.label}: Export package inspector must expose visible artifact files`);
      assert(await visible(station), `${viewport.label}: Export handoff station must be visible`);
      assert(await visible(artifactStrip), `${viewport.label}: downstream handoff station must still expose visible artifact files`);
      await assertWithinFirstViewport(page, fileBrowser, `${viewport.label}: first-viewport package file browser`);

      const stripText = await normalizedText(fileBrowser);
      for (const artifactName of REQUIRED_ARTIFACTS) {
        assert(
          stripText.toLowerCase().includes(artifactName.toLowerCase()),
          `${viewport.label}: package file browser must include ${artifactName}; got "${stripText}"`
        );
      }

      const artifactExplorer = page.locator('[data-testid="ide-export-artifact-preview"]').first();
      assert(await visible(artifactExplorer), `${viewport.label}: downstream artifact explorer must still render`);
      const surfaceText = await normalizedText(page.locator('[data-testid="ide-mode-export"]').first());
      assert(
        !/E1\s+(ready|passed|complete)|E2\s+(ready|passed|complete)|E3\s+(ready|passed|complete)|Vivado build passed|board observed/i.test(surfaceText),
        `${viewport.label}: Export browser view must not claim external Vivado/Basys3 proof`
      );

      observations.push({
        viewport: viewport.label,
        inspector: await readRect(page, '[data-testid="ide-export-package-inspector-v1"]'),
        fileBrowser: await readRect(page, '[data-testid="ide-export-file-browser-v1"]'),
        strip: await readRect(page, '[data-testid="ide-export-handoff-artifact-strip"]'),
        explorer: await readRect(page, '[data-testid="ide-export-artifact-preview"]'),
        text: stripText,
      });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeObservations(observations);
  assert(failures.length === 0, `Export first-viewport artifact failures:\n${failures.join('\n')}`);
});

async function openReadyToBuildExport(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=export-first-viewport-artifacts-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });

  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), `${viewportLabel}: Verify Compare mode must be available`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const verifyStatus = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(verifyStatus), `${viewportLabel}: Export artifact visibility proof requires Compare PASS, got "${verifyStatus}"`);

  await page.locator('[data-testid="mode-button-export"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-handoff-station"]', { timeout: 10000 });
}

async function assertWithinFirstViewport(page, locator, label) {
  const box = await locator.boundingBox();
  assert(box, `${label} must have a measurable box`);
  const viewport = page.viewportSize();
  assert(viewport, `${label} gate requires a viewport`);
  assert(box.y >= 0, `${label} must not start above the viewport: y=${box.y.toFixed(1)}`);
  assert(
    box.y + Math.min(box.height, 48) <= viewport.height,
    `${label} must expose artifact names in the first viewport: bottom=${(box.y + Math.min(box.height, 48)).toFixed(1)} viewport=${viewport.height}`
  );
}

async function capture(page, label) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `export-first-viewport-artifacts-${label}.png`),
    fullPage: false,
  });
}

async function writeObservations(observations) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(SCREENSHOT_DIR, 'export-first-viewport-artifacts-observations.json'),
    JSON.stringify(observations, null, 2)
  );
}

async function readRect(page, selector) {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: Number(rect.top.toFixed(1)),
      bottom: Number(rect.bottom.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
      visibleHeight: Number((Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top)).toFixed(1)),
    };
  }, selector);
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
