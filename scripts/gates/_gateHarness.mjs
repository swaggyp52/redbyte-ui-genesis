#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const START_TIMEOUT_MS = 30000;

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function visible(locator) {
  return locator.first().isVisible().catch(() => false);
}

export async function loadStarterProject(page, options = {}) {
  const { preferredLabStarterTestId } = options;

  await ensureProjectMode(page);

  const starterSelectors = [
    preferredLabStarterTestId ? `[data-testid="${preferredLabStarterTestId}"]` : null,
    '[data-testid="ide-project-load-start-signal-tour"]',
    '[data-testid="ide-project-landing-example-signal-tour"]',
    '[data-testid="ide-project-load-start-logic-gates"]',
    '[data-testid^="ide-project-landing-example-"]',
    '[data-testid="ide-project-example-load"] button',
    '[data-testid^="ide-project-lab-card-"]',
  ].filter(Boolean);

  for (const selector of starterSelectors) {
    const starter = page.locator(selector).first();
    if (!(await starter.isVisible().catch(() => false))) {
      continue;
    }

    await clickLocatorElement(starter);
    await confirmExampleReplacementIfNeeded(page);
    await waitForStarterToLoad(page);
    return;
  }

  throw new Error(
    `starter project CTA was not visible in any supported Project surface state. Tried: ${starterSelectors.join(', ')}`
  );
}

export async function ensureVerifyVectorsReady(page) {
  const hasExistingVectors = await page
    .locator('[data-testid="ide-verify-vectors-table"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (hasExistingVectors) return 'existing';

  const runBar = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runBarVisible = await runBar.isVisible().catch(() => false);
  const runBarText = runBarVisible ? ((await runBar.textContent()) ?? '').trim() : '';
  if (/vector/i.test(runBarText)) return 'existing';

  const selectors = [
    '[data-testid="ide-verify-generate-basic-vectors"]',
    '[data-testid="ide-verify-generate-basic-vectors-footer"]',
    '[data-testid="ide-verify-generate-all-combos"]',
    '[data-testid="ide-verify-guided-clock-pattern"]',
    '[data-testid="ide-verify-trace-generate-basics"]',
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return 'generated';
    }
  }

  throw new Error('verify had neither a visible generate-basics action nor an existing ready-vector state');
}

export async function runIdeGate(name, runScenario) {
  let browser;
  let context;
  let previewProcess;
  let previewLogs = '';

  try {
    const port = await reservePort();
    const baseUrl = `http://${HOST}:${port}`;
    previewProcess = startPreviewProcess(port, (chunk) => {
      previewLogs += chunk;
    });

    await waitForPreview(baseUrl);

    const ideBaseUrl = await resolveIdeBaseUrl(baseUrl);
    browser = await chromium.launch();
    context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();

    await runScenario({ page, baseUrl: ideBaseUrl });
    console.log(`PASS: ${name}.`);
  } catch (error) {
    console.error(`FAIL: ${name}.`);
    console.error(error instanceof Error ? error.message : String(error));
    if (previewLogs.trim().length > 0) {
      const lines = previewLogs
        .trim()
        .split(/\r?\n/)
        .slice(-15)
        .join('\n');
      console.error(`[preview logs]\n${lines}`);
    }
    process.exitCode = 1;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (previewProcess) {
      stopPreviewProcess(previewProcess);
    }
  }
}

async function resolveIdeBaseUrl(rootBaseUrl) {
  const normalizedRoot = normalizeBaseUrl(rootBaseUrl);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${normalizedRoot}/`, {
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const resolvedUrl = new URL(response.url);
    const normalizedPath = resolvedUrl.pathname.replace(/\/+$/, '');
    if (normalizedPath === '/os' || normalizedPath.startsWith('/os/')) {
      return `${resolvedUrl.origin}/os`;
    }
  } catch {
    // fall through to root URL
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const osCandidate = `${normalizedRoot}/os/`;
    const response = await fetch(osCandidate, {
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      return `${normalizedRoot}/os`;
    }
  } catch {
    // fall through to root URL
  }
  return normalizedRoot;
}

async function ensureProjectMode(page) {
  const projectMode = page.locator('[data-testid="ide-mode-project"]').first();
  if (await projectMode.isVisible().catch(() => false)) {
    return;
  }

  const projectButton = page.locator('[data-testid="mode-button-project"]').first();
  if (!(await projectButton.isVisible().catch(() => false))) {
    throw new Error('project mode button was not visible while trying to load a starter project');
  }

  await clickLocatorElement(projectButton);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
}

async function clickLocatorElement(locator) {
  await locator.waitFor({ state: 'attached', timeout: 10000 });
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('expected clickable HTMLElement');
    }
    element.click();
  });
}

async function confirmExampleReplacementIfNeeded(page) {
  const confirmButton = page.locator('[data-testid="ide-example-confirm"]').first();
  if (!(await confirmButton.isVisible({ timeout: 1500 }).catch(() => false))) {
    return;
  }

  await confirmButton.click({ force: true });
  await page.locator('[data-testid="ide-example-confirm-modal"]').first().waitFor({
    state: 'hidden',
    timeout: 5000,
  }).catch(() => null);
}

async function waitForStarterToLoad(page) {
  await Promise.race([
    page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 }),
    page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 10000 }),
    page.waitForSelector('[data-node-id]', { timeout: 10000 }),
  ]).catch(() => null);
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to allocate preview port')));
        return;
      }
      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

function startPreviewProcess(port, onOutput) {
  let child;
  if (process.platform === 'win32') {
    const command = `pnpm --filter @redbyte/playground exec vite preview --host ${HOST} --port ${port} --strictPort`;
    child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } else {
    child = spawn(
      'pnpm',
      [
        '--filter',
        '@redbyte/playground',
        'exec',
        'vite',
        'preview',
        '--host',
        HOST,
        '--port',
        String(port),
        '--strictPort',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  }

  child.stdout?.on('data', (chunk) => onOutput(String(chunk)));
  child.stderr?.on('data', (chunk) => onOutput(String(chunk)));
  return child;
}

async function waitForPreview(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const response = await fetch(`${baseUrl}/`, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok || (response.status >= 200 && response.status < 500)) {
        return;
      }
    } catch {
      // Preview process is still warming up.
    }
    await delay(250);
  }
  throw new Error(`preview server did not become ready within ${START_TIMEOUT_MS}ms`);
}

function stopPreviewProcess(processRef) {
  if (processRef.exitCode !== null || processRef.killed) return;

  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(processRef.pid), '/t', '/f'], { stdio: 'ignore' });
      return;
    }
    processRef.kill('SIGTERM');
  } catch {
    // fallback no-op
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}
