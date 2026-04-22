#!/usr/bin/env node
/** Abort DesignSurface chunk to see if shell survives (diagnostic). */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';

async function reservePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, HOST, () => {
      const p = s.address().port;
      s.close((e) => (e ? reject(e) : resolve(p)));
    });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPreview(baseUrl) {
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    try {
      const ac = new AbortController();
      const tm = setTimeout(() => ac.abort(), 1500);
      const r = await fetch(`${baseUrl}/`, { signal: ac.signal });
      clearTimeout(tm);
      if (r.ok || (r.status >= 200 && r.status < 500)) return;
    } catch {
      /* */
    }
    await delay(300);
  }
  throw new Error('preview timeout');
}

function startPreview(port) {
  const cmd = `pnpm --filter @redbyte/playground exec vite preview --host ${HOST} --port ${port} --strictPort`;
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', cmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return child;
}

function kill(child) {
  if (!child || child.exitCode !== null) return;
  spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
}

spawnSync('pnpm', ['--filter', '@redbyte/playground', 'build'], { stdio: 'inherit', shell: true });

const port = await reservePort();
const preview = startPreview(port);
const baseUrl = `http://${HOST}:${port}`;
await waitForPreview(baseUrl);
const ideUrl = `${baseUrl}/os`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  localStorage.setItem('rb-onboarding-v1-seen', '1');
});

let aborted = 0;
await page.route('**/*DesignSurface*.js', (route) => {
  aborted += 1;
  route.abort('failed');
});

await page.goto(`${ideUrl}/?mode=design`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const loading = await page.locator('[data-testid="ide-surface-loading"]').isVisible().catch(() => false);
const crash = await page.locator('[data-testid="rb-ide-boot-crash"]').isVisible().catch(() => false);
const design = await page.locator('[data-testid="ide-mode-design"]').isVisible().catch(() => false);
const root = await page.locator('[data-testid="ide-root"]').isVisible().catch(() => false);
const errorFallback = await page.locator('[data-testid="error-boundary-fallback"]').isVisible().catch(() => false);
const boundaryHit = await page.evaluate(() => Boolean(window.__RB_ERROR_BOUNDARY_HIT__));

console.log(
  JSON.stringify(
    {
      abortedChunks: aborted,
      ideRoot: root,
      designVisible: design,
      suspenseLoading: loading,
      crashUi: crash,
      errorBoundaryFallback: errorFallback,
      boundaryHit,
    },
    null,
    2
  )
);

await browser.close();
kill(preview);
