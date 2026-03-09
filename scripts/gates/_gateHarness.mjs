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
