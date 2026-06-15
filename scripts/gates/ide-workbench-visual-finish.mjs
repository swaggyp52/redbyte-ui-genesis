#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
];

const SCREENSHOT_ROOT = process.env.RB_WORKBENCH_VISUAL_FINISH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_WORKBENCH_VISUAL_FINISH_SCREENSHOTS_DIR)
  : '';

const metricsLog = [];

await runIdeGate('IDE workbench visual finish satisfied', async ({ page, baseUrl }) => {
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
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await checkSurface(failures, page, viewport, 'import-empty-no-project', async () => {
      await openFreshMode(page, baseUrl, viewport, 'import');
      await page.waitForSelector('[data-testid="ide-import-start-shell"]', { timeout: 15000 });
      await capture(page, viewport, 'import-empty-no-project');
      await assertImportFirstLook(page, viewport);
    });

    await checkSurface(failures, page, viewport, 'project-first-launch', async () => {
      await openFreshMode(page, baseUrl, viewport, 'project');
      await capture(page, viewport, 'project-first-launch');
      await assertNoHorizontalOverflow(page, viewport, 'Project first launch');
      await assertVisiblePrimary(page, viewport, 'Project first launch', [
        '[data-testid="ide-project-command-center"]',
        '[data-testid="ide-project-landing"]',
      ]);
    });

    await checkSurface(failures, page, viewport, 'design-blank-no-circuit', async () => {
      await openFreshMode(page, baseUrl, viewport, 'design');
      await capture(page, viewport, 'design-blank-no-circuit');
      await assertNoHorizontalOverflow(page, viewport, 'Design blank state');
      await assertVisiblePrimary(page, viewport, 'Design blank state', [
        '[data-testid="ide-design-live-canvas"]',
        '[data-testid="ide-design-workspace"]',
        '[data-testid="ide-design-empty"]',
      ]);
    });

    await checkSurface(failures, page, viewport, 'export-draft-no-project', async () => {
      await openFreshMode(page, baseUrl, viewport, 'export');
      await capture(page, viewport, 'export-draft-no-project');
      await assertNoHorizontalOverflow(page, viewport, 'Export no-project draft');
      await assertVisiblePrimary(page, viewport, 'Export no-project draft', [
        '[data-testid="ide-export-handoff-station"]',
        '[data-testid="ide-export-panel"]',
      ]);
    });

    await checkSurface(failures, page, viewport, 'project-loaded-starter', async () => {
      await openFreshMode(page, baseUrl, viewport, 'project');
      await loadStarterProject(page, { exactExampleId: 'logic-gates' });
      await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
      await openMode(page, 'project');
      await capture(page, viewport, 'project-loaded-starter');
      await assertNoHorizontalOverflow(page, viewport, 'Project loaded starter');
      await assertVisiblePrimary(page, viewport, 'Project loaded starter', [
        '[data-testid="ide-project-command-center"]',
        '[data-testid="ide-project-panel"]',
      ]);
    });

    await checkSurface(failures, page, viewport, 'export-loaded-starter-draft', async () => {
      await openMode(page, 'export');
      await capture(page, viewport, 'export-loaded-starter-draft');
      await assertNoHorizontalOverflow(page, viewport, 'Export loaded starter');
      await assertVisiblePrimary(page, viewport, 'Export loaded starter', [
        '[data-testid="ide-export-handoff-station"]',
        '[data-testid="ide-export-panel"]',
      ]);
    });
  }

  await writeMetrics();

  assert(
    consoleFindings.length === 0,
    `Workbench visual finish gate emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
  assert(failures.length === 0, `Workbench visual finish failures:\n${failures.join('\n')}`);
});

async function openFreshMode(page, baseUrl, viewport, mode) {
  await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=workbench-visual-finish-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(100);
}

async function openMode(page, mode) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  assert(await visible(button), `mode button "${mode}" must be visible`);
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(100);
}

async function checkSurface(failures, page, viewport, surface, callback) {
  try {
    await callback();
  } catch (error) {
    failures.push(`${viewport.label}/${surface}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    metricsLog.push({
      viewport: viewport.label,
      surface,
      metrics: await readVisualMetrics(page).catch((error) => ({
        readError: error instanceof Error ? error.message : String(error),
      })),
    });
  }
}

async function assertImportFirstLook(page, viewport) {
  await assertNoHorizontalOverflow(page, viewport, 'Import first look');

  const commandStrip = page.locator('[data-testid="ide-import-command-strip"]').first();
  assert(
    !(await visible(commandStrip)),
    `${viewport.label}: Import first look must not repeat the restore message in a command strip`
  );

  const restoreHeadlineCount = await page.evaluate(() => {
    const phrase = 'Restore a RedByte project first';
    return Array.from(document.querySelectorAll('body *')).filter((element) => {
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      if (text !== phrase) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).length;
  });
  assert(
    restoreHeadlineCount === 1,
    `${viewport.label}: Import first look should expose one restore headline, found ${restoreHeadlineCount}`
  );

  await assertRectInViewport(page, viewport, '[data-testid="ide-import-start-shell"]', 'Import start shell');
  await assertRectInViewport(page, viewport, '[data-testid="ide-import-start-primary"]', 'Import RedByte ZIP CTA');
  await assertRectInViewport(
    page,
    viewport,
    '[data-testid="ide-import-start-alternatives"]',
    'Import visible alternatives',
    88
  );
  await assertRectInViewport(page, viewport, '[data-testid="ide-import-start-guidance"]', 'Import recovery guidance');

  const alternativesText = await normalizedText(page.locator('[data-testid="ide-import-start-alternatives"]').first());
  for (const label of ['Paste HDL', 'Try structural sample', 'Show unsupported examples']) {
    assert(
      alternativesText.includes(label),
      `${viewport.label}: Import visible alternatives must include "${label}" (${alternativesText})`
    );
  }

  const shell = await rectForSelector(page, '[data-testid="ide-import-start-shell"]');
  assert(shell.top < viewport.height * 0.32, `${viewport.label}: Import start shell begins too low (${shell.top}px)`);
  assert(
    shell.bottom <= viewport.height - 18,
    `${viewport.label}: Import start shell should fit the first viewport (${Math.round(shell.bottom)}px > ${viewport.height}px)`
  );
}

async function assertVisiblePrimary(page, viewport, label, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await visible(locator)) {
      await assertRectInViewport(page, viewport, selector, label);
      return;
    }
  }
  throw new Error(`${viewport.label}: ${label} primary object missing (${selectors.join(', ')})`);
}

async function assertRectInViewport(page, viewport, selector, label, minVisibleHeight = 24) {
  const rect = await rectForSelector(page, selector);
  assert(rect.visible, `${viewport.label}: ${label} must be visible`);
  assert(rect.top < viewport.height - 24, `${viewport.label}: ${label} starts below the first viewport`);
  assert(
    rect.visibleHeight >= minVisibleHeight,
    `${viewport.label}: ${label} visible height ${rect.visibleHeight.toFixed(1)}px is too small`
  );
}

async function assertNoHorizontalOverflow(page, viewport, label) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth ?? 0),
    };
  });
  assert(
    metrics.scrollWidth <= metrics.clientWidth + 1,
    `${viewport.label}: ${label} has horizontal overflow (${metrics.scrollWidth}px > ${metrics.clientWidth}px)`
  );
}

async function rectForSelector(page, selector) {
  return page.locator(selector).first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    const style = window.getComputedStyle(element);
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      visibleHeight: Math.max(0, visibleBottom - visibleTop),
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        visibleBottom > 0 &&
        rect.top < window.innerHeight,
    };
  });
}

async function readVisualMetrics(page) {
  return page.evaluate(() => {
    const readRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { visible: false, width: 0, height: 0, top: 0, bottom: 0, visibleHeight: 0 };
      const rect = element.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      return {
        visible: rect.width > 0 && rect.height > 0 && visibleBottom > 0 && rect.top < window.innerHeight,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        visibleHeight: Math.max(0, visibleBottom - visibleTop),
      };
    };

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      rects: {
        importPanel: readRect('[data-testid="ide-import-panel"]'),
        importCommandStrip: readRect('[data-testid="ide-import-command-strip"]'),
        importStartShell: readRect('[data-testid="ide-import-start-shell"]'),
        importAlternatives: readRect('[data-testid="ide-import-start-alternatives"]'),
        importGuidance: readRect('[data-testid="ide-import-start-guidance"]'),
        projectCommandCenter: readRect('[data-testid="ide-project-command-center"]'),
        designCanvas: readRect('[data-testid="ide-design-live-canvas"]'),
        exportStation: readRect('[data-testid="ide-export-handoff-station"]'),
      },
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

async function writeMetrics() {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await fs.writeFile(path.join(SCREENSHOT_ROOT, 'metrics.json'), `${JSON.stringify(metricsLog, null, 2)}\n`);
}

async function normalizedText(locator) {
  return (await locator.textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}
