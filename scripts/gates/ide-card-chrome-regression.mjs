#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE card chrome regression guard satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await openLogicGatesStarter(page, baseUrl, `card-chrome-regression-${viewport.label}`);
      await openMode(page, baseUrl, 'project', `card-chrome-regression-${viewport.label}`);
      await assertCardChrome(page, viewport, 'project', {
        root: '[data-testid="ide-project-command-center"]',
        maxLargeStaticBlocks: 2,
      });

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=card-chrome-regression-${viewport.label}-import`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertCardChrome(page, viewport, 'import', {
        root: '[data-testid="ide-import-panel"]',
        maxLargeStaticBlocks: 2,
      });

      await openLogicGatesStarter(page, baseUrl, `card-chrome-regression-${viewport.label}-export`);
      await openMode(page, baseUrl, 'verify', `card-chrome-regression-${viewport.label}-export`);
      await runComparePass(page);
      await openMode(page, baseUrl, 'export', `card-chrome-regression-${viewport.label}-export`);
      await assertCardChrome(page, viewport, 'export', {
        root: '[data-testid="ide-export-panel"]',
        maxLargeStaticBlocks: 3,
      });

      await assertNoRootOverflow(page, `${viewport.label}/card chrome`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Card chrome regression browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Card chrome regression failures:\n${failures.join('\n')}`);
});

async function assertCardChrome(page, viewport, surface, options) {
  const metrics = await page.evaluate(({ root, viewportHeight }) => {
    const rootElement = document.querySelector(root);
    if (!rootElement) return { rootFound: false, largeStaticBlocks: 999, labels: ['missing root'] };
    const selectors = [
      '[class*="guidance-card"]',
      '[class*="summary-stat"]',
      '[class*="metric"]',
      '[class*="card"]',
      '[class*="hero"]',
      '[class*="callout"]',
      '[class*="panel"]',
    ].join(',');
    const labels = Array.from(rootElement.querySelectorAll(selectors))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const interactive = element.matches('button, [role="button"], a[href], input, select, textarea') || Boolean(element.querySelector('button, [role="button"], a[href], input, select, textarea'));
        const compactEvidence = Boolean(element.closest('[data-testid="ide-project-evidence-strip-v1"]'));
        const visible = rect.width > 140 && rect.height > 42 && rect.top >= 0 && rect.top < viewportHeight && style.display !== 'none' && style.visibility !== 'hidden';
        const className = `${element.className}`;
        const tagName = element.tagName.toLowerCase();
        const textOnly = ['h1', 'h2', 'h3', 'h4', 'p', 'span', 'small', 'strong'].includes(tagName);
        const containerClass = /(guidance-card|summary-stat|metric|card|callout|panel)(?:\b|__|--)/.test(className);
        const borderWidth = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderRightWidth || '0');
        const hasChrome = containerClass || (!textOnly && (borderWidth > 0 || style.boxShadow !== 'none'));
        return visible && hasChrome && !interactive && !compactEvidence;
      })
      .map((element) => `${element.className}`.replace(/\s+/g, '.').slice(0, 120));
    return { rootFound: true, largeStaticBlocks: labels.length, labels };
  }, { root: options.root, viewportHeight: viewport.height });

  assert(metrics.rootFound, `${viewport.label}/${surface}: surface root not found`);
  assert(
    metrics.largeStaticBlocks <= options.maxLargeStaticBlocks,
    `${viewport.label}/${surface}: too many non-interactive card-like blocks (${metrics.largeStaticBlocks} > ${options.maxLargeStaticBlocks}): ${metrics.labels.join(' | ')}`
  );
}
