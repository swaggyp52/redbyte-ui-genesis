#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_ROOT = process.env.RB_VERIFY_NO_CIRCUIT_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_NO_CIRCUIT_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify no-circuit task-first entry', async ({ page, baseUrl }) => {
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
    await openDirectVerify(page, baseUrl, viewport.label);
    await capture(page, viewport, 'direct-verify-no-circuit');
    await assertBuildHash(page, `${viewport.label}/direct Verify`);

    const metrics = await readMetrics(page);
    assert(metrics.mode === 'verify', `${viewport.label}: expected Verify mode, got "${metrics.mode}"`);
    assert(!metrics.hasBoundary, `${viewport.label}: error boundary must not be visible`);
    assert(metrics.rootOverflowX <= 2, `${viewport.label}: root must not horizontally overflow (${metrics.rootOverflowX}px)`);
    assert(metrics.taskBox, `${viewport.label}: no-circuit task panel must be measurable`);
    assert(metrics.taskBox.y <= 360, `${viewport.label}: no-circuit task panel starts too low (${metrics.taskBox.y}px)`);
    assert(
      metrics.taskBox.bottom <= viewport.height - 24,
      `${viewport.label}: no-circuit task panel must fit in the first viewport (bottom=${metrics.taskBox.bottom}, viewport=${viewport.height})`
    );
    assert(
      metrics.taskText.includes('no circuit') || metrics.taskText.includes('nothing to verify'),
      `${viewport.label}: task panel must explain that there is no circuit yet (${metrics.taskText})`
    );
    assert(
      !/(no io mapping yet|map pins|board & constraints|board pins|view on hardware|run (?:verify|simulate) to see waveforms)/i.test(metrics.panelText),
      `${viewport.label}: blank Simulate must not blame mapping/hardware or waveform apparatus (${metrics.panelText})`
    );
    assert(!metrics.labGridVisible, `${viewport.label}: blank Verify must not render the lab waveform/testbench grid`);

    const designButton = page.locator('[data-testid="ide-verify-no-circuit-open-design"]').first();
    const starterButton = page.locator('[data-testid="ide-verify-no-circuit-load-starter"]').first();
    const importButton = page.locator('[data-testid="ide-verify-no-circuit-import-recover"]').first();
    assert(await visible(designButton), `${viewport.label}: Open Design action must be visible`);
    assert(await visible(starterButton), `${viewport.label}: Load starter action must be visible`);
    assert(await visible(importButton), `${viewport.label}: Import / Recover action must be visible`);

    await designButton.click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

    await openDirectVerify(page, baseUrl, `${viewport.label}-starter-route`);
    await starterButton.click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
    assert(
      await visible(page.locator('[data-testid="ide-project-command-center"]').first()),
      `${viewport.label}: Load starter must route to Project command center`
    );

    await openDirectVerify(page, baseUrl, `${viewport.label}-import-route`);
    await importButton.click();
    await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 10000 });
    const importWorkbench = page.locator('[data-testid="ide-import-workbench"]').first();
    const importStepper = page.locator('[data-testid="ide-import-horizontal-stepper"]').first();
    const importWorkbenchText = ((await importWorkbench.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const importSteps = (await importStepper.locator('li').allTextContents()).map((step) => step.replace(/\s+/g, ' ').trim());
    assert(
      await visible(importWorkbench) &&
        await visible(importStepper) &&
        importSteps.length === 3 &&
        /upload/i.test(importSteps[0]) &&
        /review/i.test(importSteps[1]) &&
        /apply/i.test(importSteps[2]) &&
        /recover a project without replacing current work early/i.test(importWorkbenchText),
      `${viewport.label}: Import / Recover must route to the v3 recovery workspace with Upload, Review, Apply, and the no-early-replacement boundary`
    );
  }

  assert(
    findings.length === 0,
    `Verify no-circuit task-first gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

async function openDirectVerify(page, baseUrl, label) {
  await page.goto(`${baseUrl}/?mode=verify&e2e=1&gate=verify-no-circuit-task-first-${label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
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
    const task = document.querySelector('[data-testid="ide-verify-no-circuit-task"]');
    const panel = document.querySelector('[data-testid="ide-verify-panel"]');
    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');

    function visibleText(node) {
      if (!node) return '';
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
      if (!(node instanceof HTMLElement)) return '';
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        return '';
      }
      return Array.from(node.childNodes).map((child) => visibleText(child)).join(' ');
    }

    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? '',
      hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
      rootOverflowX: Math.max(
        0,
        root instanceof HTMLElement ? root.scrollWidth - root.clientWidth : document.documentElement.scrollWidth - window.innerWidth
      ),
      taskBox: box('[data-testid="ide-verify-no-circuit-task"]'),
      taskText: visibleText(task).replace(/\s+/g, ' ').trim().toLowerCase(),
      panelText: visibleText(panel).replace(/\s+/g, ' ').trim().toLowerCase(),
      labGridVisible: Boolean(labGrid && labGrid instanceof HTMLElement && labGrid.offsetParent !== null),
    };
  });
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
