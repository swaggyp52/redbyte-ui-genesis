#!/usr/bin/env node

import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  setVerifyRunMode,
} from '../gates/_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from '../gates/_verifyStatus.mjs';

const HOST = '127.0.0.1';
const DEFAULT_PROFILES = 30;
const START_TIMEOUT_MS = 30_000;
const OUTPUT_ROOT = path.resolve('.redbyte/rehearsal/phase-3f');

const options = parseArgs(process.argv.slice(2));

let browser;
let previewProcess;
let previewLogs = '';

try {
  const port = await reservePort();
  const rootBaseUrl = `http://${HOST}:${port}`;
  previewProcess = startPreviewProcess(port, (chunk) => {
    previewLogs += chunk;
  });
  await waitForPreview(rootBaseUrl);
  const baseUrl = await resolveIdeBaseUrl(rootBaseUrl);
  browser = await chromium.launch();

  const startedAt = performance.now();
  const results = [];
  for (let index = 0; index < options.profiles; index += 1) {
    const studentId = `student-${String(index + 1).padStart(2, '0')}`;
    results.push(await runProfile(browser, baseUrl, studentId, options.scenario));
  }
  const durationMs = Math.round(performance.now() - startedAt);
  const passCount = results.filter((result) => result.pass).length;
  const failCount = results.length - passCount;
  const summary = {
    schema: 'redbyte.phase3f.classroom-rehearsal.v1',
    scenario: options.scenario,
    profiles: options.profiles,
    passCount,
    failCount,
    durationMs,
    generatedAtIso: new Date().toISOString(),
    results,
    limits: [
      'Browser rehearsal only; no Vivado build, board programming, or physical board observation.',
      'Current storage remains localStorage; journaled rolling snapshots remain future work.',
    ],
  };

  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const jsonPath = path.join(OUTPUT_ROOT, `classroom-${options.scenario}-${options.profiles}.json`);
  const mdPath = path.join(OUTPUT_ROOT, `classroom-${options.scenario}-${options.profiles}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, renderMarkdown(summary), 'utf8');

  console.log(`[classroom-rehearsal] scenario=${options.scenario} profiles=${options.profiles} pass=${passCount} fail=${failCount}`);
  console.log(`[classroom-rehearsal] evidence=${jsonPath}`);
  if (failCount > 0) {
    console.error(renderFailureSummary(summary));
    process.exitCode = 1;
  }
} catch (error) {
  console.error('[classroom-rehearsal] FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  if (previewLogs.trim()) {
    console.error(`[preview logs]\n${previewLogs.trim().split(/\r?\n/).slice(-20).join('\n')}`);
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (previewProcess) stopPreviewProcess(previewProcess);
}

async function runProfile(browserInstance, baseUrl, studentId, scenario) {
  const context = await browserInstance.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
    const findings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      findings.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));

  try {
    await page.addInitScript((id) => {
      const marker = `rb-phase-3f-classroom-${id}`;
      if (window.name === marker) return;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('rb-onboarding-v1-seen', '1');
      sessionStorage.setItem('rb.phase3f.studentId', id);
      window.name = marker;
    }, studentId);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=classroom-30-${scenario}-${studentId}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
    await loadStarterProject(page, { exactExampleId: 'logic-gates' });

    const projectName = `Phase 3F ${studentId}`;
    await renameProject(page, projectName);

    if (scenario === 'verify' || scenario === 'full') {
      await runVerifyPass(page);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    const restored = await page.evaluate((expectedName) => {
      const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
      return {
        projectName: runtime?.projectName ?? null,
        nodeCount: runtime?.circuit?.nodes?.length ?? 0,
        lastRunStatus: runtime?.verifyLastRun?.status ?? null,
        hasExpectedName: document.body.innerText.includes(expectedName),
        runtimeStatePresent: Boolean(localStorage.getItem('rb.ide.project-runtime.v1')),
        snapshotCount: Object.keys(localStorage).filter((key) => key.startsWith('rb.ide.project.v1:')).length,
      };
    }, projectName);
    assert(restored.hasExpectedName, `${studentId}: project name did not restore after reload: ${JSON.stringify(restored)}`);
    assert(restored.nodeCount > 0, `${studentId}: project graph did not restore after reload: ${JSON.stringify(restored)}`);
    assert(restored.runtimeStatePresent, `${studentId}: runtime storage key missing after reload`);
    assert(restored.snapshotCount >= 1, `${studentId}: saved project snapshot missing after reload`);

    if (scenario === 'recovery' || scenario === 'full') {
      await proveCorruptStorageRecovery(page, studentId);
    }

    assert(findings.length === 0, `${studentId}: browser findings ${JSON.stringify(findings.slice(0, 8))}`);
    return { studentId, pass: true, restored };
  } catch (error) {
    return {
      studentId,
      pass: false,
      error: error instanceof Error ? error.message : String(error),
      findings,
    };
  } finally {
    await context.close();
  }
}

async function renameProject(page, nextName) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  await title.waitFor({ state: 'visible', timeout: 10000 });
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(nextName);
  await page.keyboard.press('Enter');
  await page.waitForFunction((name) => document.body.innerText.includes(name), nextName, { timeout: 10000 });
}

async function runVerifyPass(page) {
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  const duplicate = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  if (await duplicate.isVisible().catch(() => false)) {
    await duplicate.click();
    await page.waitForFunction(() => {
      const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
      return authority?.getAttribute('data-provenance') === 'student';
    }, null, { timeout: 10000 });
  }
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable in classroom rehearsal');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const status = await readV2AuthorityStatus(page);
  assert(isVerifyPass(status), `classroom rehearsal Verify should PASS, got "${status}"`);
}

async function proveCorruptStorageRecovery(page, studentId) {
  await page.evaluate(() => {
    localStorage.setItem('rb.ide.project-runtime.v1', '{"state": {"projectName": ');
    localStorage.setItem('rb.ide.sessionMeta.v1', '{"version":1,"projectId":');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  const recovered = await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    return {
      projectName: runtime?.projectName ?? null,
      lastRunStatus: runtime?.verifyLastRun?.status ?? null,
      errorBoundary: Boolean(document.querySelector('[data-testid="ide-error-boundary"]')),
    };
  });
  assert(!recovered.errorBoundary, `${studentId}: corrupt storage showed error boundary`);
  assert(recovered.projectName, `${studentId}: corrupt storage did not recover to a valid project`);
  assert(recovered.lastRunStatus !== 'pass', `${studentId}: corrupt storage resurrected trusted PASS`);
}

async function readV2AuthorityStatus(page) {
  const authority = page.locator('[data-testid="ide-verify-v2-authority"]').first();
  if (await authority.isVisible().catch(() => false)) {
    return (await authority.getAttribute('data-result-status')) ?? '';
  }
  return (await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '';
}

function parseArgs(argv) {
  const parsed = { profiles: DEFAULT_PROFILES, scenario: 'full' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--profiles') {
      parsed.profiles = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }
    if (arg?.startsWith('--profiles=')) {
      parsed.profiles = Number.parseInt(arg.split('=')[1] ?? '', 10);
      continue;
    }
    if (arg === '--scenario') {
      parsed.scenario = argv[index + 1] ?? parsed.scenario;
      index += 1;
      continue;
    }
    if (arg?.startsWith('--scenario=')) {
      parsed.scenario = arg.split('=')[1] ?? parsed.scenario;
    }
  }
  if (!Number.isFinite(parsed.profiles) || parsed.profiles < 1) parsed.profiles = DEFAULT_PROFILES;
  if (!['full', 'verify', 'recovery'].includes(parsed.scenario)) parsed.scenario = 'full';
  return parsed;
}

function renderMarkdown(summary) {
  const rows = summary.results
    .map((result) => `| ${result.studentId} | ${result.pass ? 'PASS' : 'FAIL'} | ${result.error ?? 'Reload/recovery path completed'} |`)
    .join('\n');
  return `# Phase 3F Classroom Rehearsal

- Scenario: ${summary.scenario}
- Profiles: ${summary.profiles}
- Passed: ${summary.passCount}
- Failed: ${summary.failCount}
- Duration ms: ${summary.durationMs}
- Generated: ${summary.generatedAtIso}

## Limits

${summary.limits.map((line) => `- ${line}`).join('\n')}

## Results

| Profile | Status | Notes |
|---|---|---|
${rows}
`;
}

function renderFailureSummary(summary) {
  return summary.results
    .filter((result) => !result.pass)
    .map((result) => `${result.studentId}: ${result.error}`)
    .join('\n');
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
      server.close((closeError) => (closeError ? reject(closeError) : resolve(port)));
    });
  });
}

function startPreviewProcess(port, onOutput) {
  const command = process.platform === 'win32'
    ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `pnpm --filter @redbyte/playground exec vite preview --host ${HOST} --port ${port} --strictPort`]]
    : ['pnpm', ['--filter', '@redbyte/playground', 'exec', 'vite', 'preview', '--host', HOST, '--port', String(port), '--strictPort']];
  const child = spawn(command[0], command[1], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
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
      if (response.ok || (response.status >= 200 && response.status < 500)) return;
    } catch {
      // Preview is warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`preview server did not become ready within ${START_TIMEOUT_MS}ms`);
}

async function resolveIdeBaseUrl(rootBaseUrl) {
  const normalized = rootBaseUrl.replace(/\/+$/, '');
  try {
    const response = await fetch(`${normalized}/os/`, { redirect: 'follow' });
    if (response.ok) return `${normalized}/os`;
  } catch {
    // Fall back to root.
  }
  return normalized;
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
    // no-op
  }
}
