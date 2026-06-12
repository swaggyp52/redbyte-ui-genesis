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
  const { preferredLabStarterTestId, exactExampleId } = options;

  await ensureProjectMode(page);

  if (exactExampleId) {
    if (await loadExactExample(page, exactExampleId)) return;

    await loadAnyVisibleStarter(page, { preferredLabStarterTestId });
    await ensureProjectMode(page);

    if (await loadExactExample(page, exactExampleId)) return;

    throw new Error(`exact starter example "${exactExampleId}" was not visible in any supported Project state`);
  }

  await loadAnyVisibleStarter(page, { preferredLabStarterTestId });
}

async function loadAnyVisibleStarter(page, options = {}) {
  const { preferredLabStarterTestId } = options;

  const starterSelectors = [
    preferredLabStarterTestId ? `[data-testid="${preferredLabStarterTestId}"]` : null,
    '[data-testid="ide-project-load-start-signal-tour"]',
    '[data-testid="ide-project-landing-example-signal-tour"]',
    '[data-testid="ide-project-load-start-logic-gates"]',
    '[data-testid^="ide-project-landing-example-"]',
    '[data-testid^="ide-project-load-start-"]',
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

async function loadExactExample(page, exampleId) {
  await openExamplesBrowserIfPresent(page);

  const selectors = [
    `[data-testid="ide-project-load-start-${exampleId}"]`,
    `[data-testid="ide-projectx-example-load-${exampleId}"] button`,
    `[data-testid="ide-projectx-path-step-${exampleId}"]`,
    `[data-testid="ide-project-landing-example-${exampleId}"]`,
    `[data-testid="ide-project-lab-card-${exampleId}"]`,
  ];

  for (const selector of selectors) {
    const starter = page.locator(selector).first();
    if (!(await starter.isVisible().catch(() => false))) {
      continue;
    }

    await clickLocatorElement(starter);
    await confirmExampleReplacementIfNeeded(page);
    await waitForStarterToLoad(page);
    return true;
  }

  return false;
}

async function openExamplesBrowserIfPresent(page) {
  const browser = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  if (!(await browser.count().catch(() => 0))) return;

  const expanded = (await browser.getAttribute('data-expanded').catch(() => 'true')) !== 'false';
  if (expanded) return;

  const toggle = page.locator('[data-testid="ide-projectx-examples-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await clickLocatorElement(toggle);
  }
}

export async function ensureVerifyVectorsReady(page) {
  if (await hasCurrentVerifyVectors(page)) return 'existing';

  const hasExistingVectors = await page
    .locator('[data-testid="ide-verify-vectors-table"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (hasExistingVectors) return 'existing';

  const runBar = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runBarVisible = await runBar.isVisible().catch(() => false);
  const runBarText = runBarVisible ? ((await runBar.textContent()) ?? '').trim() : '';
  // Use \d+\s+vector to distinguish "4 vectors ready" from "Open Project vectors" button text.
  if (/\d+\s+vector/i.test(runBarText)) return 'existing';

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
      // Wait for vectors to be committed to runtime (run bar shows "N vectors ready").
      await page
        .waitForFunction(
          () => {
            const rb = document.querySelector('[data-testid="ide-verify-workstation-run-bar"]');
            const empty = document.querySelector('[data-testid="ide-verify-empty-state"]');
            const status = document.querySelector('[data-testid="ide-vcb-status"]');
            const run = document.querySelector('[data-testid="ide-vcb-run"]');
            return (
              (rb && /\d+\s+vector/i.test(rb.textContent || '')) ||
              (empty && /current vectors are ready|saved checks available/i.test(empty.textContent || '')) ||
              (status && /ready/i.test(status.textContent || '') && run)
            );
          },
          { timeout: 10000 }
        )
        .catch(() => null);
      return 'generated';
    }
  }

  throw new Error('verify had neither a visible generate-basics action nor an existing ready-vector state');
}

async function hasCurrentVerifyVectors(page) {
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  if (await vectorTable.isVisible().catch(() => false)) return true;

  const runBar = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runBarText = (await runBar.textContent().catch(() => ''))?.trim() ?? '';
  if (/\d+\s+vector/i.test(runBarText)) return true;

  const emptyState = page.locator('[data-testid="ide-verify-empty-state"]').first();
  const emptyStateText = (await emptyState.textContent().catch(() => ''))?.trim() ?? '';
  if (/current vectors are ready|saved checks available/i.test(emptyStateText)) return true;

  const statusText =
    (await page.locator('[data-testid="ide-vcb-status"]').first().textContent().catch(() => ''))?.trim() ?? '';
  const runVisible = await page.locator('[data-testid="ide-vcb-run"]').first().isVisible().catch(() => false);
  return /ready/i.test(statusText) && runVisible;
}

export async function clickVerifyRun(page) {
  const selectors = [
    '[data-testid="ide-vcb-run"]',
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    return selector;
  }
  throw new Error('verify run button was not visible in any supported state');
}

export async function setVerifyRunMode(page, mode) {
  const selector =
    mode === 'compare'
      ? '[data-testid="ide-vcb-use-saved-checks"]'
      : '[data-testid="ide-vcb-observe-only"]';
  const button = page.locator(selector).first();
  const isVisible = await button.isVisible().catch(() => false);
  if (!isVisible) return false;
  const isDisabled = await button.isDisabled().catch(() => true);
  if (isDisabled) return false;
  const isPressed = (await button.getAttribute('aria-pressed').catch(() => 'false')) === 'true';
  if (!isPressed) {
    await button.click();
  }
  return true;
}

export async function saveObservedOutputs(page) {
  const directSelectors = [
    '[data-testid="ide-vcb-save-expected"]',
    '[data-testid="ide-verify-run-proof-oracle"]',
    '[data-testid="ide-verify-stale-recapture-reauthor"]',
    '[data-testid="ide-verify-set-oracle"]',
  ];

  for (const selector of directSelectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    const isDisabled = await button.isDisabled().catch(() => false);
    if (isDisabled) continue;
    await button.click();
    return selector;
  }

  const utilitiesToggle = page.locator('[data-testid="ide-vcb-utilities-toggle"]').first();
  const toggleVisible = await utilitiesToggle.isVisible().catch(() => false);
  if (toggleVisible) {
    await utilitiesToggle.click();
    const saveButton = page.locator('[data-testid="ide-vcb-save-expected"]').first();
    const saveVisible = await saveButton.isVisible().catch(() => false);
    const saveDisabled = await saveButton.isDisabled().catch(() => false);
    if (saveVisible && !saveDisabled) {
      await saveButton.click();
      return '[data-testid="ide-vcb-save-expected"]';
    }
    await utilitiesToggle.click();
  }

  return null;
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
