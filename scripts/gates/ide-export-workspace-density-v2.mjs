#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

const DENSITY_VIEWPORTS = [...CLASSROOM_VIEWPORTS, { label: '1920x1080', width: 1920, height: 1080 }];
const proofDate = process.env.RB_EXPORT_DENSITY_DATE || new Date().toISOString().slice(0, 10);
const proofPhase = process.env.RB_EXPORT_DENSITY_PHASE || 'after';
const proofRoot = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'export-workspace-density',
  proofDate,
  proofPhase
);

await runIdeGate('IDE Export workspace density V2 satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  mkdirSync(proofRoot, { recursive: true });

  const failures = [];

  for (const viewport of DENSITY_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `export-workspace-density-v2-${viewport.label}`);
      await openMode(page, baseUrl, 'verify', `export-workspace-density-v2-${viewport.label}`);
      await runComparePass(page);
      await openMode(page, baseUrl, 'export', `export-workspace-density-v2-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      const workspace = page.locator('[data-v2-testid="ide-export-artifact-workspace-v2"]').first();
      const fileBrowser = page.locator('[data-testid="ide-export-file-browser-v1"]').first();
      const preview = page.locator('[data-testid="ide-export-selected-preview-v1"]').first();
      assert(await visible(workspace), `${viewport.label}: Export artifact workspace must be visible`);
      assert(await visible(fileBrowser), `${viewport.label}: Export artifact tree must be visible`);
      assert(await visible(preview), `${viewport.label}: Export selected preview must be visible`);

      await page.screenshot({
        path: path.join(proofRoot, `export-workspace-density-${viewport.label}.png`),
        fullPage: false,
      });

      const metrics = await page.evaluate(() => {
        const isVisible = (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const rectFor = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visibleWidth: Math.round(Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left))),
            visibleHeight: Math.round(Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))),
          };
        };
        const rows = Array.from(document.querySelectorAll('.ide-export-file-browser-v1__file')).filter(isVisible);
        const rowHeights = rows.map((row) => Math.round(row.getBoundingClientRect().height));
        const statusPills = rows.flatMap((row) =>
          Array.from(row.querySelectorAll('.ide-status-pill')).filter(isVisible)
        );
        const longRows = rowHeights.filter((height) => height > 58);
        const checklist = rectFor('[data-testid="ide-export-handoff-checklist-v1"]');
        const tree = rectFor('[data-testid="ide-export-file-browser-v1"]');
        const previewRect = rectFor('[data-testid="ide-export-selected-preview-v1"]');
        const previewCode = rectFor('[data-testid="ide-export-preview-code"]');
        const previewText = (document.querySelector('[data-testid="ide-export-preview-code"]')?.textContent || '').trim();
        return {
          rowCount: rows.length,
          rowHeights,
          longRows,
          statusPillCount: statusPills.length,
          checklist,
          tree,
          preview: previewRect,
          previewCode,
          previewHasGeneratedSource: /entity\s+|architecture\s+|PACKAGE_PIN|README|Vivado/i.test(previewText),
        };
      });

      assert(metrics.rowCount >= 6, `${viewport.label}: Export artifact tree must expose at least 6 generated files`);
      assert(
        metrics.statusPillCount === 0,
        `${viewport.label}: Export artifact rows must not render repeated status pills (${metrics.statusPillCount} found)`
      );
      assert(
        metrics.longRows.length === 0,
        `${viewport.label}: Export artifact rows must stay compact, heights=${metrics.rowHeights.join(', ')}`
      );
      assert(metrics.checklist?.visibleHeight <= 64, `${viewport.label}: Handoff checklist too tall (${metrics.checklist?.visibleHeight}px)`);
      assert(metrics.tree?.visibleWidth >= 230, `${viewport.label}: Artifact tree too narrow (${metrics.tree?.visibleWidth}px)`);
      assert(metrics.tree?.visibleHeight >= 300, `${viewport.label}: Artifact tree too short (${metrics.tree?.visibleHeight}px)`);
      assert(
        metrics.preview?.visibleWidth >= Math.round(viewport.width * 0.44),
        `${viewport.label}: Artifact preview is not dominant enough (${metrics.preview?.visibleWidth}px)`
      );
      assert(
        metrics.preview?.visibleHeight >= (viewport.height === 768 ? 320 : 410),
        `${viewport.label}: Artifact preview too short (${metrics.preview?.visibleHeight}px)`
      );
      assert(
        metrics.preview?.visibleWidth >= Math.round((metrics.tree?.visibleWidth ?? 0) * 1.55),
        `${viewport.label}: Artifact preview must be clearly wider than the tree (${metrics.preview?.visibleWidth}px vs ${metrics.tree?.visibleWidth}px)`
      );
      assert(metrics.previewCode?.visibleHeight >= 250, `${viewport.label}: Preview code viewport too short (${metrics.previewCode?.visibleHeight}px)`);
      assert(metrics.previewHasGeneratedSource, `${viewport.label}: Preview must expose generated file source`);

      await page.locator('[data-testid="ide-export-file-top-xdc"]').first().click();
      await page.waitForFunction(
        () => (document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent ?? '').trim() === 'top.xdc',
        null,
        { timeout: 10000 }
      );
      const xdcPreview = await normalizedText(page.locator('[data-testid="ide-export-preview-code"]').first());
      assert(/PACKAGE_PIN|get_ports/i.test(xdcPreview), `${viewport.label}: top.xdc must update the direct preview`);
      await assertNoRootOverflow(page, `${viewport.label}/Export density`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Export density browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Export density failures:\n${failures.join('\n')}`);
});

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
