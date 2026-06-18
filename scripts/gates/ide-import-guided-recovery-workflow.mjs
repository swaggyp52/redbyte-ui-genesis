#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  assertVisibleRect,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const SCREENSHOT_ROOT = process.env.RB_IMPORT_GUIDED_RECOVERY_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_IMPORT_GUIDED_RECOVERY_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE import guided recovery workflow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await assertPasteHdlRecovery(page, baseUrl, viewport);
      await assertBlockedSampleRecovery(page, baseUrl, viewport);
      await assertNoRootOverflow(page, `${viewport.label}/import-guided-recovery`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(
    browserProblems.length === 0,
    `Import guided recovery browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`
  );
  assert(failures.length === 0, `Import guided recovery failures:\n${failures.join('\n')}`);
});

async function assertPasteHdlRecovery(page, baseUrl, viewport) {
  await openFreshImport(page, baseUrl, `paste-hdl-${viewport.label}`);
  await assertBuildHash(page, viewport.label);

  const startHero = page.locator('[data-testid="ide-import-start-hero"]').first();
  const startSecondary = page.locator('[data-testid="ide-import-start-secondary"]').first();
  assert(await visible(startHero), `${viewport.label}: first-look Import must keep the guided start hero`);
  assert(await visible(startSecondary), `${viewport.label}: first-look Import must expose Paste HDL`);

  await startSecondary.click();
  await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });
  await page.waitForTimeout(120);
  await capture(page, viewport, 'paste-hdl-active');

  await assertActiveImportTaskPlane(page, viewport, 'Paste HDL');
  await assertNoVisibleStartShell(page, viewport, 'Paste HDL');
  await assertVisibleRect(page, ['[data-testid="ide-import-workbench"]'], `${viewport.label}/Paste HDL workbench`, {
    maxTop: viewport.height === 768 ? 280 : 320,
    minWidth: Math.round(viewport.width * 0.48),
    minHeight: 260,
  });
  await assertVisibleRect(page, ['[data-testid="ide-import-hdl-textarea"]'], `${viewport.label}/Paste HDL editor`, {
    maxTop: viewport.height === 768 ? 430 : 470,
    minWidth: Math.round(viewport.width * 0.42),
    minHeight: viewport.height === 768 ? 150 : 210,
  });
}

async function assertBlockedSampleRecovery(page, baseUrl, viewport) {
  await openFreshImport(page, baseUrl, `blocked-sample-${viewport.label}`);

  const behavioralToggle = page.locator('[data-testid="ide-import-toggle-behavioral-samples"]').first();
  assert(await visible(behavioralToggle), `${viewport.label}: unsupported examples toggle must be reachable`);
  await behavioralToggle.click();

  const blockedSample = page.locator('[data-testid="ide-import-load-sample-edge-detect"]').first();
  assert(await visible(blockedSample), `${viewport.label}: blocked behavioral sample must be reachable`);
  await blockedSample.click();
  await page.waitForSelector('[data-testid="ide-import-workbench"]', { timeout: 10000 });
  await page.waitForTimeout(120);
  await capture(page, viewport, 'blocked-sample-active');

  await assertActiveImportTaskPlane(page, viewport, 'Unsupported HDL');
  await assertNoVisibleStartShell(page, viewport, 'Unsupported HDL');
  await assertVisibleRect(page, ['[data-testid="ide-import-workbench"]'], `${viewport.label}/Blocked sample workbench`, {
    maxTop: viewport.height === 768 ? 280 : 320,
    minWidth: Math.round(viewport.width * 0.48),
    minHeight: 260,
  });
  await assertVisibleRect(
    page,
    ['[data-testid="ide-import-behavioral-warning"]', '[data-testid="ide-import-review-shell"]'],
    `${viewport.label}/Blocked sample warning or review`,
    {
      maxTop: viewport.height === 768 ? 520 : 580,
      minWidth: Math.round(viewport.width * 0.40),
      minHeight: 42,
    }
  );

  const bodyText = (await page.locator('[data-testid="ide-import-panel"]').first().textContent().catch(() => '')) ?? '';
  assert(/Behavioral HDL|blocked|structural/i.test(bodyText), `${viewport.label}: blocked sample must explain recovery limits`);
  assert(
    !/observed physical board|programmed the board|Vivado build passed|bitstream verified/i.test(bodyText),
    `${viewport.label}: Import must not claim Vivado or hardware proof`
  );
}

async function openFreshImport(page, baseUrl, gateLabel) {
  await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=import-guided-recovery-${gateLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
}

async function assertActiveImportTaskPlane(page, viewport, expectedText) {
  const activeTaskbar = page.locator('[data-testid="ide-import-active-taskbar"]').first();
  assert(await visible(activeTaskbar), `${viewport.label}: active Import must show a compact task bar`);
  const taskbarText = ((await activeTaskbar.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  assert(new RegExp(expectedText, 'i').test(taskbarText), `${viewport.label}: task bar must name "${expectedText}", got "${taskbarText}"`);
  assert(/Parse HDL|Review Import|Apply Pins|Start fresh/i.test(taskbarText), `${viewport.label}: task bar must expose direct recovery actions`);
}

async function assertNoVisibleStartShell(page, viewport, label) {
  const visibleStartShellCount = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="ide-import-start-shell"], [data-testid="ide-import-start-hero"]')).filter(
      (element) => {
        const bounds = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
      }
    ).length;
  });
  assert(visibleStartShellCount === 0, `${viewport.label}/${label}: active recovery must not keep the intake start shell visible`);
}

async function capture(page, viewport, label) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${label}-${viewport.label}.png`),
    fullPage: false,
  });
}
