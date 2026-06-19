#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const CURRENT_SHA_LONG = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const OUT_DIR = process.env.RB_FINAL_BUILD_SMOKE_OUT_DIR ? path.resolve(process.env.RB_FINAL_BUILD_SMOKE_OUT_DIR) : null;

if (process.env.RB_FINAL_BUILD_SMOKE_ALLOW_DIRTY !== '1') {
  const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (dirty.length > 0) {
    console.error('[ide:gate:final-current-build-smoke] worktree must be clean for final current-build proof.');
    console.error(dirty);
    process.exit(1);
  }
}

await runIdeGate('IDE final current build smoke satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await proveCurrentBuildAcrossModes(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Final current-build smoke browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Final current-build smoke failures:\n${failures.join('\n')}`);
});

async function proveCurrentBuildAcrossModes(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=final-current-build-smoke-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertCurrentBuild(page, `${viewport.label}/project initial`);
  await capture(page, viewport, 'project');

  for (const mode of ['design', 'verify', 'hardware', 'export', 'import', 'project']) {
    await openMode(page, baseUrl, mode, `final-current-build-smoke-${viewport.label}`);
    await assertCurrentBuild(page, `${viewport.label}/${mode}`);
    await capture(page, viewport, mode);
  }
}

async function assertCurrentBuild(page, label) {
  await assertBuildHash(page, label);
  await assertNoRootOverflow(page, label);
  const state = await page.evaluate(async () => {
    const fetchJson = async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };
    const buildJson = (await fetchJson('./build.json')) || (await fetchJson('/os/build.json')) || (await fetchJson('/build.json'));
    const bodyText = document.body.textContent?.replace(/\s+/g, ' ').slice(0, 2000) ?? '';
    return {
      badge: document.querySelector('.ide-build-badge-sha')?.textContent?.trim() ?? '',
      buildJson,
      hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
      boundaryText: document.querySelector('[data-testid="error-boundary-fallback"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      loadingText: document.querySelector('[data-testid="ide-surface-loading"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      bodyText,
    };
  });
  assert(state.badge === CURRENT_SHA, `${label}: visible build badge ${state.badge || 'missing'} != ${CURRENT_SHA}`);
  assert(state.buildJson, `${label}: build.json was not readable from the served app`);
  assert(
    typeof state.buildJson.sha === 'string' && CURRENT_SHA_LONG.startsWith(state.buildJson.sha.slice(0, 7)),
    `${label}: build.json sha ${state.buildJson.sha || 'missing'} does not match HEAD ${CURRENT_SHA_LONG}`
  );
  assert(!state.hasBoundary, `${label}: workspace error boundary visible: ${state.boundaryText}`);
  assert(!/workspace encountered an error|loading failed|dynamic import/i.test(state.bodyText), `${label}: stop-ship workspace load text visible`);
}

async function capture(page, viewport, mode) {
  if (!OUT_DIR) return;
  await fs.mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(OUT_DIR, `${mode}-${viewport.label}.png`),
    fullPage: false,
  });
}
