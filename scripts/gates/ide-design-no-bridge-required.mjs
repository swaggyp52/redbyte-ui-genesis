#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const ARTIFACT_ROOT = path.resolve(
  process.env.RB_DESIGN_NO_BRIDGE_SCREENSHOTS_DIR ||
    path.join(process.cwd(), '.redbyte', 'product-immersion', 'design-no-bridge-required')
);

const VIEWPORTS = [
  { label: 'classroom-1366x768', width: 1366, height: 768 },
  { label: 'desktop-1440x900', width: 1440, height: 900 },
];

const BRIDGE_URL_RE = /^(https?|wss?):\/\/(?:127\.0\.0\.1|localhost):4242(?:\/|$)/i;

await runIdeGate('IDE design no bridge required', async ({ page, baseUrl }) => {
  const bridgeRequests = [];
  const consoleFindings = [];
  const results = [];

  page.on('request', (request) => {
    const url = request.url();
    if (BRIDGE_URL_RE.test(url)) {
      bridgeRequests.push({ type: 'request', method: request.method(), url });
    }
  });
  page.on('websocket', (socket) => {
    const url = socket.url();
    if (BRIDGE_URL_RE.test(url)) {
      bridgeRequests.push({ type: 'websocket', url });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleFindings.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    consoleFindings.push({ type: 'pageerror', text: error.message });
  });

  await page.route(/^(https?):\/\/(?:127\.0\.0\.1|localhost):4242(?:\/|$)/i, async (route) => {
    bridgeRequests.push({
      type: 'route',
      method: route.request().method(),
      url: route.request().url(),
    });
    await route.abort('blockedbyclient');
  });

  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    localStorage.setItem('rb-hardware-mode', 'on');
  });

  await mkdir(ARTIFACT_ROOT, { recursive: true });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-no-bridge-required`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
    await page.waitForSelector('[data-node-id]', { timeout: 15000 });
    await page.waitForTimeout(500);

    const state = await readDesignNoBridgeState(page);
    assert(
      state.buildSha === CURRENT_SHA,
      `${viewport.label}: visible build sha must match current git sha ${CURRENT_SHA}, got ${state.buildSha || 'missing'}`
    );
    assert(state.mode === 'design', `${viewport.label}: expected Design mode, got ${state.mode}`);
    assert(!state.hasErrorBoundary, `${viewport.label}: error boundary fallback was visible`);
    assert(!state.hasBootCrash, `${viewport.label}: IDE boot crash marker was visible`);
    assert(!state.hasBridgeFatalText, `${viewport.label}: bridge fatal copy appeared in Design`);
    assert(state.canvas.width >= 320, `${viewport.label}: Design canvas width too small (${state.canvas.width})`);
    assert(state.canvas.height >= 240, `${viewport.label}: Design canvas height too small (${state.canvas.height})`);
    assert(state.nodeCount >= 3, `${viewport.label}: starter graph did not render nodes (${state.nodeCount})`);

    const screenshotPath = path.join(ARTIFACT_ROOT, `${viewport.label}-design-loaded-no-bridge.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    results.push({ ...viewport, screenshotPath, state });
  }

  assert(
    bridgeRequests.length === 0,
    `Design must not request the hardware bridge before Hardware mode. Requests: ${JSON.stringify(bridgeRequests)}`
  );
  assert(
    consoleFindings.length === 0,
    `Design no-bridge gate emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );

  await writeFile(
    path.join(ARTIFACT_ROOT, 'design-no-bridge-required.json'),
    JSON.stringify({ gitSha: CURRENT_SHA, bridgeRequests, consoleFindings, results }, null, 2)
  );
});

async function readDesignNoBridgeState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const rect = canvas?.getBoundingClientRect?.() ?? new DOMRect(0, 0, 0, 0);
    const bodyText = document.body.innerText || '';
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      buildSha: document.querySelector('.ide-build-badge-sha')?.textContent?.trim() ?? '',
      hasErrorBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
      hasBootCrash: Boolean(document.querySelector('[data-testid="rb-ide-boot-crash"]')),
      hasBridgeFatalText: /RedByte Bridge Unreachable|Bridge Unreachable|bridge agent/i.test(bodyText),
      canvas: { width: rect.width, height: rect.height },
      nodeCount: document.querySelectorAll('[data-node-id]').length,
    };
  });
}
