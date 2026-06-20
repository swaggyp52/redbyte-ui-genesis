#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const SCREENSHOT_ROOT = process.env.RB_DESIGN_WORKSPACE_CRASH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_DESIGN_WORKSPACE_CRASH_SCREENSHOTS_DIR)
  : null;

await runIdeGate('IDE Design workspace crash-proof recovery satisfied', async ({ page, baseUrl }) => {
  const consoleFindings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') {
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
    let abortedDesignChunk = false;
    await page.unroute('**/*').catch(() => null);
    await page.route(/\/assets\/DesignSurface-[^/]+\.js(?:\?.*)?$/, async (route) => {
      if (!abortedDesignChunk) {
        abortedDesignChunk = true;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/?mode=design&e2e=1&gate=design-workspace-crash-proof-${viewport.label}`, {
      waitUntil: 'domcontentloaded',
    });

    await page.waitForSelector('[data-testid="error-boundary-fallback"]', { timeout: 15000 });
    await capture(page, viewport, '01-design-load-failure');

    const failure = await readBoundaryState(page);
    assert(abortedDesignChunk, `${viewport.label}: DesignSurface chunk was not intercepted`);
    assert(
      /Design workspace encountered an error/i.test(failure.text),
      `${viewport.label}: boundary did not identify the Design workspace`
    );
    assert(
      failure.isSurfaceLoadError,
      `${viewport.label}: boundary did not classify the failed lazy surface load`
    );
    assert(failure.reloadButtonVisible, `${viewport.label}: non-destructive reload recovery button was missing`);
    assert(failure.resetButtonVisible, `${viewport.label}: destructive reset escape hatch must remain available`);

    await page.locator('[data-testid="error-boundary-reload-app"]').first().click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 15000 });
    await capture(page, viewport, '02-design-recovered');

    const recovered = await readRecoveredDesignState(page);
    assert(recovered.mode === 'design', `${viewport.label}: recovered mode should be design, got ${recovered.mode}`);
    assert(!recovered.hasBoundary, `${viewport.label}: error boundary remained after reload recovery`);
    assert(recovered.buildBadge.length > 0, `${viewport.label}: build badge disappeared after recovery`);
    assert(recovered.rootOverflowX <= 2, `${viewport.label}: root has horizontal overflow after recovery`);

    await page.unroute('**/*').catch(() => null);
  }

  const unexpectedErrors = consoleFindings.filter((finding) => {
    const text = finding.text ?? '';
    return !(
      /Failed to fetch dynamically imported module/i.test(text) ||
      (/Failed to load resource: net::ERR_FAILED/i.test(text) &&
        /DesignSurface-[^/]+\.js/i.test(finding.location?.url ?? '')) ||
      /RB_FATAL:.*Failed to fetch dynamically imported module/i.test(text) ||
      /^Stack: TypeError: Failed to fetch dynamically imported module/i.test(text) ||
      /^Component stack:/i.test(text)
    );
  });
  assert(
    unexpectedErrors.length === 0,
    `Design crash-proof recovery emitted unexpected console/page errors: ${JSON.stringify(unexpectedErrors.slice(0, 8))}`
  );
});

async function readBoundaryState(page) {
  return page.evaluate(() => {
    const boundary = document.querySelector('[data-testid="error-boundary-fallback"]');
    const reload = document.querySelector('[data-testid="error-boundary-reload-app"]');
    const reset = document.querySelector('[data-testid="error-boundary-reset-workspace"]');
    return {
      text: boundary?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      isSurfaceLoadError: boundary?.getAttribute('data-error-kind') === 'surface-load',
      reloadButtonVisible: isVisible(reload),
      resetButtonVisible: isVisible(reset),
    };

    function isVisible(element) {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    }
  });
}

async function readRecoveredDesignState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="ide-root"]') ?? document.documentElement;
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
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
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
