#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, assertBuildFreshReplacementModal, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_ROOT = process.env.RB_PROJECT_LOADED_PATHS_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_PROJECT_LOADED_PATHS_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Project loaded paths own first viewport', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    findings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openLoadedProject(page, baseUrl, viewport.label);
    await capture(page, viewport, 'loaded-project-paths');

    let metrics = await readMetrics(page);
    assert(metrics.mode === 'project', `${viewport.label}: expected Project mode, got "${metrics.mode}"`);
    await assertBuildHash(page, `${viewport.label}/loaded Project`);
    assert(!metrics.hasBoundary, `${viewport.label}: error boundary must not be visible`);
    assert(metrics.rootOverflowX <= 2, `${viewport.label}: root must not horizontally overflow (${metrics.rootOverflowX}px)`);
    assert(metrics.commandBox, `${viewport.label}: loaded command center must be measurable`);
    assert(!metrics.entryBox, `${viewport.label}: alternate Project paths must begin collapsed`);
    assert(metrics.changeProjectBox, `${viewport.label}: Change Project disclosure control must be measurable`);
    assert(
      metrics.changeProjectBox.bottom <= viewport.height - 16,
      `${viewport.label}: Change Project must fit inside the first viewport (bottom=${metrics.changeProjectBox.bottom}, viewport=${viewport.height})`
    );
    assert(metrics.primaryBox, `${viewport.label}: loaded Project must keep one primary next-stage action`);
    assert(
      metrics.primaryText.includes('simulate'),
      `${viewport.label}: loaded Logic Gates primary must name Simulate as the next incomplete stage (${metrics.primaryText})`
    );
    assert(
      metrics.hasVerifyPrimaryRoute,
      `${viewport.label}: loaded Logic Gates primary must expose Simulate routing truth`
    );
    await revealChangePaths(page);
    await page.locator('[data-testid="ide-project-entry-paths"]').first().scrollIntoViewIfNeeded();
    metrics = await readMetrics(page);
    assert(metrics.entryBox, `${viewport.label}: Change Project must reveal alternate paths`);
    assert(
      metrics.visibleEntryPathCount >= 4,
      `${viewport.label}: all four alternate Project paths must be visible after disclosure, saw ${metrics.visibleEntryPathCount}`
    );
    assert(
      metrics.entryText.includes('build fresh') &&
        metrics.entryText.includes('starter') &&
        metrics.entryText.includes('import') &&
        metrics.entryText.includes('open'),
      `${viewport.label}: alternate Project paths must expose build/starter/import/open options (${metrics.entryText})`
    );

    await page.locator('[data-testid="ide-project-command-strip-primary-cta"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

    await page.locator('[data-testid="mode-button-project"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
    await revealChangePaths(page);

    await page.locator('[data-testid="ide-project-path-import-recover"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 10000 });

    await page.locator('[data-testid="mode-button-project"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
    await revealChangePaths(page);

    await page.locator('[data-testid="ide-project-path-build-fresh"]').first().click();
    await assertBuildFreshReplacementModal(page, `${viewport.label}: Build Fresh from loaded Project`);
    assert(
      await visible(page.locator('[data-testid="ide-mode-project"]').first()),
      `${viewport.label}: dismissing Build Fresh guard must leave Project mode active`
    );
  }

  assert(
    findings.length === 0,
    `Project loaded paths gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

async function openLoadedProject(page, baseUrl, label) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=project-loaded-paths-first-viewport-${label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
}

async function readMetrics(page) {
  return page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    }

    const root = document.querySelector('[data-testid="ide-root"]') ?? document.documentElement;
    const entry = document.querySelector('[data-testid="ide-project-entry-paths"]');
    const entryButtons = Array.from(document.querySelectorAll('[data-testid^="ide-project-path-"]'));
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? '',
      hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
      rootOverflowX: Math.max(
        0,
        root instanceof HTMLElement ? root.scrollWidth - root.clientWidth : document.documentElement.scrollWidth - window.innerWidth
      ),
      commandBox: box('[data-testid="ide-project-command-center"]'),
      changeProjectBox: box('[data-testid="ide-project-change-project"]'),
      primaryBox: box('[data-testid="ide-project-command-strip-primary-cta"]'),
      primaryText:
        document
          .querySelector('[data-testid="ide-project-command-strip-primary-cta"]')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim()
          .toLowerCase() ?? '',
      hasVerifyPrimaryRoute: Boolean(
        document.querySelector('[data-testid="ide-project-command-action-verify"]')
      ),
      entryBox: box('[data-testid="ide-project-entry-paths"]'),
      visibleEntryPathCount: entryButtons.filter((button) => {
        if (!(button instanceof HTMLElement)) return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight + 1;
      }).length,
      entryText: entry?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '',
    };
  });
}

async function revealChangePaths(page) {
  const entryPaths = page.locator('[data-testid="ide-project-entry-paths"]').first();
  if (await entryPaths.isVisible().catch(() => false)) return;
  const trigger = page.locator('[data-testid="ide-project-change-project"]').first();
  assert(await visible(trigger), 'Loaded Project must expose Change Project');
  await trigger.click();
  await entryPaths.waitFor({ state: 'visible', timeout: 10000 });
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
