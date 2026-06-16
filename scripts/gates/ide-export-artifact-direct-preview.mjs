#!/usr/bin/env node

/**
 * Export artifact direct-preview gate.
 *
 * Contract:
 * 1) Generated-file cues in the first-viewport handoff station are real buttons, not static chips.
 * 2) Clicking a file cue selects that generated artifact and reveals the preview workspace.
 * 3) Keyboard activation follows the same path, and the browser view does not claim Vivado/Basys3 proof.
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
const SCREENSHOT_DIR = process.env.RB_EXPORT_ARTIFACT_DIRECT_PREVIEW_SCREENSHOTS_DIR?.trim() || '';
const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

await runIdeGate('IDE export artifact direct preview satisfied', async ({ page, baseUrl }) => {
  const browserProblems = [];
  page.on('pageerror', (error) => {
    browserProblems.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserProblems.push(`console.error: ${message.text()}`);
    }
  });

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

      const buildSha = (await page.locator('.ide-build-badge-sha').first().textContent().catch(() => ''))?.trim() ?? '';
      assert(
        buildSha === CURRENT_SHA,
        `${viewport.label}: visible build sha must match current git sha ${CURRENT_SHA}, got ${buildSha || 'missing'}`
      );

      const topVhd = page.locator('[data-testid="ide-export-handoff-artifact-top-vhd"]').first();
      const topXdc = page.locator('[data-testid="ide-export-handoff-artifact-top-xdc"]').first();
      assert(await visible(topVhd), `${viewport.label}: top.vhd handoff cue must be visible`);
      assert(await visible(topXdc), `${viewport.label}: top.xdc handoff cue must be visible`);
      await assertWithinFirstViewport(page, topVhd, `${viewport.label}: top.vhd handoff cue`);

      const chipSemantics = await topVhd.evaluate((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') ?? '',
        tabIndex: element instanceof HTMLElement ? element.tabIndex : null,
        ariaLabel: element.getAttribute('aria-label') ?? '',
        ariaPressed: element.getAttribute('aria-pressed') ?? '',
        cursor: window.getComputedStyle(element).cursor,
      }));
      assert(chipSemantics.tag === 'button', `${viewport.label}: top.vhd cue must be a button, got ${chipSemantics.tag}`);
      assert(/preview top\.vhd/i.test(chipSemantics.ariaLabel), `${viewport.label}: top.vhd cue needs a preview aria-label`);
      assert(chipSemantics.tabIndex === 0, `${viewport.label}: top.vhd button must be keyboard reachable`);
      assert(chipSemantics.cursor === 'pointer', `${viewport.label}: top.vhd button must advertise pointer affordance`);

      const initialPreviewPath = await previewPath(page);
      await topVhd.click();
      await waitForPreviewPath(page, 'top.vhd');
      await assertPreviewVisible(page, `${viewport.label}: top.vhd preview`);
      const topVhdCode = await normalizedText(page.locator('[data-testid="ide-export-preview-code"]').first());
      assert(/entity\s+|architecture\s+/i.test(topVhdCode), `${viewport.label}: top.vhd preview must show generated VHDL`);
      assert(
        (await topVhd.getAttribute('aria-pressed').catch(() => '')) === 'true',
        `${viewport.label}: top.vhd cue must expose selected state after click`
      );

      await topXdc.focus();
      await page.keyboard.press('Enter');
      await waitForPreviewPath(page, 'top.xdc');
      await assertPreviewVisible(page, `${viewport.label}: top.xdc preview`);
      const topXdcCode = await normalizedText(page.locator('[data-testid="ide-export-preview-code"]').first());
      assert(/PACKAGE_PIN|get_ports/i.test(topXdcCode), `${viewport.label}: top.xdc preview must show generated constraints`);
      assert(
        (await topXdc.getAttribute('aria-pressed').catch(() => '')) === 'true',
        `${viewport.label}: top.xdc cue must expose selected state after keyboard activation`
      );

      const surfaceText = await normalizedText(page.locator('[data-testid="ide-mode-export"]').first());
      assert(
        !/E1\s+(ready|passed|complete)|E2\s+(ready|passed|complete)|E3\s+(ready|passed|complete)|Vivado build passed|board observed/i.test(surfaceText),
        `${viewport.label}: Export browser view must not claim external Vivado/Basys3 proof`
      );
      await assertNoRootHorizontalOverflow(page, viewport.label);
      await capture(page, `export-artifact-direct-preview-${viewport.label}.png`);

      observations.push({
        viewport: viewport.label,
        initialPreviewPath,
        finalPreviewPath: await previewPath(page),
        topVhd: chipSemantics,
        preview: await readRect(page, '[data-testid="ide-export-artifact-preview"]'),
        code: await readRect(page, '[data-testid="ide-export-preview-code"]'),
      });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeObservations(observations, browserProblems);
  assert(failures.length === 0, `Export direct-preview failures:\n${failures.join('\n')}`);
  assert(browserProblems.length === 0, `Export direct-preview browser errors:\n${browserProblems.join('\n')}`);
});

async function openReadyToBuildExport(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=export-artifact-direct-preview-${viewportLabel}`, {
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
  assert(isVerifyPass(verifyStatus), `${viewportLabel}: Export direct-preview proof requires Compare PASS, got "${verifyStatus}"`);

  await page.locator('[data-testid="mode-button-export"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-handoff-station"]', { state: 'visible', timeout: 10000 });
}

async function waitForPreviewPath(page, artifactPath) {
  await page.waitForFunction(
    (expected) => {
      const marker = document.querySelector('[data-testid="ide-export-preview-path"]');
      return (marker?.textContent ?? '').trim() === expected;
    },
    artifactPath,
    { timeout: 10000 }
  );
}

async function previewPath(page) {
  return ((await page.locator('[data-testid="ide-export-preview-path"]').first().textContent().catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function assertWithinFirstViewport(page, locator, label) {
  const box = await locator.boundingBox();
  assert(box, `${label} must have a measurable box`);
  const viewport = page.viewportSize();
  assert(viewport, `${label} gate requires a viewport`);
  assert(box.y >= 0, `${label} must not start above the viewport: y=${box.y.toFixed(1)}`);
  assert(
    box.y + Math.min(box.height, 44) <= viewport.height,
    `${label} must expose the file control in the first viewport: bottom=${(box.y + Math.min(box.height, 44)).toFixed(1)} viewport=${viewport.height}`
  );
}

async function assertPreviewVisible(page, label) {
  const selector = '[data-testid="ide-export-artifact-preview"]';
  await page.waitForFunction(
    (targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const visibleHeight = Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top);
      return visibleHeight >= 180;
    },
    selector,
    { timeout: 10000 }
  );
  const locator = page.locator(selector).first();
  assert(await visible(locator), `${label} region must be visible`);
  const box = await locator.boundingBox();
  assert(box, `${label} must have a measurable box`);
  const viewport = page.viewportSize();
  assert(viewport, `${label} gate requires a viewport`);
  const visibleHeight = Math.min(viewport.height, box.y + box.height) - Math.max(0, box.y);
  assert(visibleHeight >= 180, `${label} must be revealed after direct selection, visibleHeight=${visibleHeight.toFixed(1)}`);
}

async function assertNoRootHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const overflow = Math.max(metrics.docScrollWidth, metrics.bodyScrollWidth) - metrics.viewportWidth;
  assert(overflow <= 1, `${label}: Export direct-preview path must not create root horizontal overflow, overflow=${overflow}`);
}

async function capture(page, fileName) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, fileName),
    fullPage: false,
  });
}

async function writeObservations(observations, browserProblems) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(SCREENSHOT_DIR, 'export-artifact-direct-preview-observations.json'),
    JSON.stringify({ observations, browserProblems }, null, 2)
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
