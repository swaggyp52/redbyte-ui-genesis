#!/usr/bin/env node
/**
 * One-off / diagnostic: fresh vs persisted IDE boot under vite preview.
 * Not part of default gate suite; run manually or from triage docs.
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const START_TIMEOUT_MS = 45000;
const ARTIFACT_DIR = path.join(process.cwd(), 'artifacts');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, HOST, () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function startPreviewFixed(port, onOutput) {
  const command = `pnpm --filter @redbyte/playground exec vite preview --host ${HOST} --port ${port} --strictPort`;
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout?.on('data', (c) => onOutput(String(c)));
  child.stderr?.on('data', (c) => onOutput(String(c)));
  return child;
}

async function waitForPreview(baseUrl) {
  const started = Date.now();
  while (Date.now() - started < START_TIMEOUT_MS) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1500);
      const res = await fetch(`${baseUrl}/`, { signal: ac.signal });
      clearTimeout(t);
      if (res.ok || (res.status >= 200 && res.status < 500)) return;
    } catch {
      /* warm-up */
    }
    await delay(300);
  }
  throw new Error('preview timeout');
}

function normalizeBaseUrl(u) {
  return u.replace(/\/+$/, '');
}

async function resolveIdeBaseUrl(rootBaseUrl) {
  const normalizedRoot = normalizeBaseUrl(rootBaseUrl);
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3000);
    const response = await fetch(`${normalizedRoot}/`, { redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    const resolvedUrl = new URL(response.url);
    const p = resolvedUrl.pathname.replace(/\/+$/, '');
    if (p === '/os' || p.startsWith('/os/')) return `${resolvedUrl.origin}/os`;
  } catch {
    /* fall through */
  }
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3000);
    const response = await fetch(`${normalizedRoot}/os/`, { redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    if (response.ok) return `${normalizedRoot}/os`;
  } catch {
    /* fall through */
  }
  return normalizedRoot;
}

function stopPreview(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  try {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } catch {
    /* no-op */
  }
}

async function runBootCase(label, { seedStorage, pathSuffix = '/', entry = 'ide' }) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const logs = [];
  const pageErrors = [];

  await context.addInitScript((seed) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (seed && typeof seed === 'object') {
        for (const [k, v] of Object.entries(seed)) {
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }
      }
    } catch (e) {
      console.warn('init storage failed', e);
    }
  }, seedStorage ?? null);

  const page = await context.newPage();
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.stack || err));
  });

  const port = await reservePort();
  let previewLogs = '';
  const preview = startPreviewFixed(port, (c) => {
    previewLogs += c;
  });
  const baseUrl = `http://${HOST}:${port}`;
  try {
    await waitForPreview(baseUrl);
    const ideUrl = await resolveIdeBaseUrl(baseUrl);
    const url =
      entry === 'root'
        ? `${normalizeBaseUrl(baseUrl)}/`
        : `${ideUrl}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(2500);

    const crashVisible = await page.locator('[data-testid="rb-ide-boot-crash"]').isVisible().catch(() => false);
    const ideRootVisible = await page.locator('[data-testid="ide-root"]').isVisible().catch(() => false);
    const projectVisible = await page.locator('[data-testid="ide-mode-project"]').isVisible().catch(() => false);
    const designVisible = await page.locator('[data-testid="ide-mode-design"]').isVisible().catch(() => false);
    const winCrash = await page.evaluate(() => (window).__rb_crash ?? null);

    if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const shot = path.join(ARTIFACT_DIR, `browser-boot-2026-04-22-${label}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    return {
      label,
      url,
      ideResolved: ideUrl,
      crashVisible,
      ideRootVisible,
      projectVisible,
      designVisible,
      winCrash,
      logs: logs.slice(-80),
      pageErrors,
      screenshot: shot,
      registerTimeoutWarn: logs.some((l) => l.includes('RB_APPS_REGISTER_TIMEOUT')),
    };
  } finally {
    await context.close();
    await browser.close();
    stopPreview(preview);
  }
}

/** Minimal valid RBProject shape for decodePersistedIdeProject (empty circuit). */
const MINIMAL_RBPROJ = {
  kind: 'rb-project',
  version: 1,
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  name: 'Triage Seed Project',
  description: '',
  circuit: { nodes: [], connections: [] },
  ioMapping: { inputs: [], outputs: [] },
  vectors: [],
  macros: [],
  meta: { projectId: 'triage-seed-proj', projectKind: 'custom' },
};

function buildCorruptSnapshotSeed() {
  const projectId = 'triage-bad-proj';
  const STORAGE_VERSION = 1;
  const PROJECT_KEY_PREFIX = `rb.ide.project.v${STORAGE_VERSION}:`;
  const snapshot = {
    version: STORAGE_VERSION,
    projectId,
    projectName: 'Bad',
    savedAtIso: new Date().toISOString(),
    projectHash: 'x',
    rbprojJson: '{ not valid rb project',
  };
  const sessionMeta = {
    version: 1,
    savedAt: Date.now(),
    projectId,
    currentMode: 'design',
    activeExampleId: null,
    probedKeys: [],
  };
  return {
    'rb.ide.sessionMeta.v1': JSON.stringify(sessionMeta),
    [`${PROJECT_KEY_PREFIX}${projectId}`]: JSON.stringify(snapshot),
    'rb-onboarding-v1-seen': '1',
  };
}

function buildPersistedSeed() {
  const projectId = 'triage-seed-proj';
  const STORAGE_VERSION = 1;
  const PROJECT_KEY_PREFIX = `rb.ide.project.v${STORAGE_VERSION}:`;
  const snapshot = {
    version: STORAGE_VERSION,
    projectId,
    projectName: 'Triage Seed',
    savedAtIso: new Date().toISOString(),
    projectHash: 'triage-hash-placeholder',
    rbprojJson: JSON.stringify(MINIMAL_RBPROJ),
  };
  const sessionMeta = {
    version: 1,
    savedAt: Date.now(),
    projectId,
    currentMode: 'project',
    activeExampleId: null,
    projectKind: 'custom',
    probedKeys: [],
  };
  return {
    'rb.ide.sessionMeta.v1': JSON.stringify(sessionMeta),
    [`${PROJECT_KEY_PREFIX}${projectId}`]: JSON.stringify(snapshot),
    'rb-onboarding-v1-seen': '1',
  };
}

console.log('Building playground first…');
const b = spawnSync('pnpm', ['--filter', '@redbyte/playground', 'build'], {
  stdio: 'inherit',
  shell: true,
});
if (b.status !== 0) process.exit(b.status ?? 1);

const onboarding = { 'rb-onboarding-v1-seen': '1' };
const fresh = await runBootCase('fresh', { seedStorage: onboarding });
const persisted = await runBootCase('persisted-session', { seedStorage: buildPersistedSeed() });
const designMode = await runBootCase('fresh-url-mode-design', {
  seedStorage: onboarding,
  pathSuffix: '/?mode=design',
});
const corrupt = await runBootCase('persisted-corrupt-snapshot', {
  seedStorage: buildCorruptSnapshotSeed(),
});
const fromRoot = await runBootCase('entry-root-index', { seedStorage: onboarding, entry: 'root' });

const results = { fresh, persisted, designMode, corrupt, fromRoot };

const outPath = path.join(ARTIFACT_DIR, 'browser-boot-2026-04-22-report.json');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

console.log('\n=== BROWSER BOOT TRIAGE ===\n');
for (const r of Object.values(results)) {
  console.log(`--- ${r.label} ---`);
  console.log('URL:', r.url);
  console.log('ide-root visible:', r.ideRootVisible);
  console.log('project mode visible:', r.projectVisible);
  console.log('design mode visible:', r.designVisible);
  console.log('boot crash UI:', r.crashVisible);
  console.log('window.__rb_crash:', r.winCrash);
  console.log('register timeout warn:', r.registerTimeoutWarn);
  if (r.pageErrors.length) console.log('PAGE ERRORS:\n', r.pageErrors.join('\n'));
  const errs = r.logs.filter((l) => l.includes('[error]') || l.includes('RB_BOOT') && l.includes('CRASH'));
  if (errs.length) console.log('Console tail errors:', errs.slice(-15).join('\n'));
  console.log('Screenshot:', r.screenshot);
  console.log('');
}

process.exit(0);
