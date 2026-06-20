#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const SCREENSHOT_ROOT = process.env.RB_WORKBENCH_STABILITY_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_WORKBENCH_STABILITY_SCREENSHOTS_DIR)
  : null;

await runIdeGate('IDE workbench stability overhaul satisfied', async ({ page, baseUrl }) => {
  const consoleFindings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      consoleFindings.push({ type: message.type(), text, location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    consoleFindings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=workbench-stability-overhaul-${viewport.label}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
    await capture(page, viewport, '01-project-first-launch');

    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-view-tools-toggle"]', { timeout: 15000 });
    await capture(page, viewport, '02-design-loaded');
    await assertCleanWorkbench(page, viewport, 'Design after starter load');

    await page.locator('[data-testid="ide-design-view-tools-toggle"]').first().click();
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="ide-design-canvas-view-tools"]')?.getAttribute('data-open') === 'true';
    }, undefined, { timeout: 5000 });
    await page.locator('[data-testid="ide-design-zoom-preset-125"]').first().click();
    await page.waitForFunction(() => {
      return /125/.test(document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent ?? '');
    }, undefined, { timeout: 5000 });
    await page.locator('[data-testid="ide-design-zoom-preset-fit"]').first().click();
    await page.waitForTimeout(200);
    await assertCleanWorkbench(page, viewport, 'Design after zoom controls');

    await page.locator('[data-testid="mode-button-verify"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
    await capture(page, viewport, '03-verify-loaded');
    await assertCleanWorkbench(page, viewport, 'Verify after Design navigation');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
    await assertCleanWorkbench(page, viewport, 'Verify after reload');

    await page.locator('[data-testid="mode-button-hardware"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
    await capture(page, viewport, '04-hardware-loaded');
    await assertCleanWorkbench(page, viewport, 'Map Pins after Verify navigation');

    await page.locator('[data-testid="mode-button-design"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 15000 });
    await capture(page, viewport, '05-design-returned');
    await assertCleanWorkbench(page, viewport, 'Design after Map Pins return');
  }

  assert(
    consoleFindings.length === 0,
    `Workbench stability overhaul emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function assertCleanWorkbench(page, viewport, label) {
  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="ide-root"]') ?? document.documentElement;
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      urlMode: new URL(window.location.href).searchParams.get('mode'),
      hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
      loading: document.querySelector('[data-testid="ide-surface-loading"]')?.textContent?.trim() ?? '',
      buildBadge:
        document.querySelector('[data-testid="ide-root"]')?.getAttribute('data-build-sha')?.trim() ??
        document.querySelector('[data-testid="ide-build-badge"]')?.textContent?.trim() ??
        '',
      rootOverflowX: Math.max(
        0,
        root instanceof HTMLElement ? root.scrollWidth - root.clientWidth : document.documentElement.scrollWidth - window.innerWidth
      ),
    };
  });

  assert(!state.hasBoundary, `${viewport.label} ${label}: error boundary was visible`);
  assert(state.mode === state.urlMode, `${viewport.label} ${label}: URL mode ${state.urlMode} did not match active mode ${state.mode}`);
  assert(state.loading.length === 0, `${viewport.label} ${label}: surface stayed in loading state (${state.loading})`);
  assert(state.buildBadge.length > 0, `${viewport.label} ${label}: build hash missing`);
  assert(state.rootOverflowX <= 2, `${viewport.label} ${label}: root has horizontal overflow (${state.rootOverflowX.toFixed(1)}px)`);
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
