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

  const intakeStepper = page.locator('[data-testid="ide-import-horizontal-stepper"]').first();
  const zipDropzone = page.locator('[data-testid="ide-import-zip-dropzone"]').first();
  const startSecondary = page.locator('[data-testid="ide-import-start-secondary"]').first();
  assert(await visible(intakeStepper), `${viewport.label}: first-look Import must show Upload, Review, Apply`);
  assert(await visible(zipDropzone), `${viewport.label}: first-look Import must expose ZIP intake`);
  assert(await visible(startSecondary), `${viewport.label}: first-look Import must expose Paste HDL`);

  await startSecondary.click();
  await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });
  await page.waitForTimeout(120);
  const editorControlFloor = await page.evaluate(() => {
    const label = document.querySelector('.ide-import-v3__editor-bar label');
    const select = document.querySelector('[data-testid="ide-import-language-select"]');
    const textarea = document.querySelector('[data-testid="ide-import-hdl-textarea"]');
    return {
      labelFontSize: label instanceof HTMLElement ? Number.parseFloat(getComputedStyle(label).fontSize) : 0,
      selectFontSize: select instanceof HTMLElement ? Number.parseFloat(getComputedStyle(select).fontSize) : 0,
      selectHeight: select instanceof HTMLElement ? select.getBoundingClientRect().height : 0,
      textareaFontSize: textarea instanceof HTMLElement ? Number.parseFloat(getComputedStyle(textarea).fontSize) : 0,
    };
  });
  assert(editorControlFloor.labelFontSize >= 13.9, `${viewport.label}: Paste HDL editor label is below 14px ${JSON.stringify(editorControlFloor)}`);
  assert(editorControlFloor.selectFontSize >= 13.9, `${viewport.label}: Paste HDL language control text is below 14px ${JSON.stringify(editorControlFloor)}`);
  assert(editorControlFloor.selectHeight >= 35.5, `${viewport.label}: Paste HDL language control is below 36px ${JSON.stringify(editorControlFloor)}`);
  assert(editorControlFloor.textareaFontSize >= 13.9, `${viewport.label}: Paste HDL editor text is below 14px ${JSON.stringify(editorControlFloor)}`);
  await capture(page, viewport, 'paste-hdl-active');

  assert(await visible(page.locator('[data-testid="ide-import-step-upload"]').first()), `${viewport.label}: Paste HDL must remain in the Upload step`);
  await assertVisibleRect(page, ['[data-testid="ide-import-workbench"]'], `${viewport.label}/Paste HDL workbench`, {
    maxTop: viewport.height === 768 ? 286 : 320,
    minWidth: Math.round(viewport.width * 0.48),
    minHeight: 260,
  });
  await assertVisibleRect(page, ['[data-testid="ide-import-hdl-textarea"]'], `${viewport.label}/Paste HDL editor`, {
    maxTop: viewport.height === 768 ? 490 : 540,
    minWidth: Math.round(viewport.width * 0.42),
    minHeight: viewport.height === 768 ? 150 : 210,
  });
}

async function assertBlockedSampleRecovery(page, baseUrl, viewport) {
  await openFreshImport(page, baseUrl, `blocked-sample-${viewport.label}`);
  await openImportExampleDisclosure(page, viewport.label);

  const blockedSample = page.locator('[data-testid="ide-import-load-sample-edge-detect"]').first();
  assert(await visible(blockedSample), `${viewport.label}: blocked behavioral sample must be reachable`);
  await blockedSample.click();
  await page.waitForSelector('[data-testid="ide-import-workbench"]', { timeout: 10000 });
  await page.waitForTimeout(120);
  await capture(page, viewport, 'blocked-sample-active');

  assert(await visible(page.locator('[data-testid="ide-import-step-upload"]').first()), `${viewport.label}: blocked HDL must remain in the Upload step`);
  await assertVisibleRect(page, ['[data-testid="ide-import-workbench"]'], `${viewport.label}/Blocked sample workbench`, {
    maxTop: viewport.height === 768 ? 286 : 320,
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

async function openImportExampleDisclosure(page, label) {
  const disclosure = page.locator('[data-testid="ide-import-example-disclosure"]').first();
  assert(await visible(disclosure), `${label}: Import must expose the labelled example disclosure`);
  if ((await disclosure.getAttribute('open')) === null) {
    await disclosure.locator(':scope > summary').click();
  }
  assert((await disclosure.getAttribute('open')) !== null, `${label}: Import example disclosure must expand`);
}

async function openFreshImport(page, baseUrl, gateLabel) {
  await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=import-guided-recovery-${gateLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
}

async function capture(page, viewport, label) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${label}-${viewport.label}.png`),
    fullPage: false,
  });
}
