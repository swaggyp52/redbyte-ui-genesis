#!/usr/bin/env node

import { execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

const HQ_HOST = '127.0.0.1';
const HQ_PORT = Number(process.env.REDBYTE_HQ_PORT || 4255);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.REDBYTE_AGENT_MODEL || 'qwen2.5-coder:1.5b';

function fail(message, details = [], code = 1) {
  process.stderr.write(`[rb-marcus-runtime] [error] ${message}\n`);
  for (const detail of details) {
    if (detail) process.stderr.write(`${detail}\n`);
  }
  process.exit(code);
}

function info(message) {
  process.stdout.write(`[rb-marcus-runtime] ${message}\n`);
}

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail('Must run inside git repository.', [reason]);
  }
}

export function resolveRuntimePaths(repoRoot) {
  const runtimeDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq', 'runtime');
  return {
    runtimeDir,
    stateJson: path.join(runtimeDir, 'marcus-runtime.json'),
    pidFile: path.join(runtimeDir, 'hq-server.pid'),
    startupMarkdown: path.join(runtimeDir, 'marcus-startup-latest.md'),
    healthMarkdown: path.join(runtimeDir, 'marcus-health-latest.md'),
    serverLog: path.join(runtimeDir, 'hq-server.log'),
  };
}

export function ensurePathWithin(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function parseRuntimeState(text) {
  try {
    const parsed = JSON.parse(String(text || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function ensureRuntimeDir(paths) {
  fs.mkdirSync(paths.runtimeDir, { recursive: true });
  for (const filePath of [paths.stateJson, paths.pidFile, paths.startupMarkdown, paths.healthMarkdown, paths.serverLog]) {
    if (!ensurePathWithin(paths.runtimeDir, filePath)) {
      throw new Error(`Runtime output path escapes runtime directory: ${filePath}`);
    }
  }
}

function readState(paths) {
  try {
    return parseRuntimeState(fs.readFileSync(paths.stateJson, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(paths, state) {
  fs.writeFileSync(paths.stateJson, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, 'utf8');
}

function run(command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    ok: (child.status ?? 1) === 0,
    status: child.status ?? 1,
    stdout: child.stdout || '',
    stderr: child.stderr || '',
  };
}

function runPnpm(repoRoot, script, extraArgs = []) {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return run(pnpm, [script, ...extraArgs], { cwd: repoRoot });
}

async function fetchJson(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      raw: text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      data: null,
      raw: '',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function isPortOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });
    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });
    socket.once('error', () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function checkHqReachable() {
  const health = await fetchJson(`http://${HQ_HOST}:${HQ_PORT}/health`);
  if (!health.ok) {
    return { ok: false, health, snapshot: null, warning: 'hq-unreachable' };
  }
  const snapshot = await fetchJson(`http://${HQ_HOST}:${HQ_PORT}/snapshot`);
  return {
    ok: snapshot.ok,
    health,
    snapshot,
    warning: snapshot.ok ? null : 'snapshot-failed',
  };
}

function checkOllamaCli() {
  if (process.platform === 'win32') {
    const cmdResult = run('powershell', ['-NoProfile', '-Command', 'Get-Command ollama -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source']);
    const source = cmdResult.stdout.trim();
    return {
      found: Boolean(source),
      path: source || null,
    };
  }

  const whichResult = run('which', ['ollama']);
  return {
    found: whichResult.ok,
    path: whichResult.ok ? whichResult.stdout.trim() : null,
  };
}

function getOllamaVersion() {
  const result = run('ollama', ['--version']);
  return result.ok ? result.stdout.trim() : null;
}

async function checkOllamaApi() {
  const tags = await fetchJson(`${OLLAMA_BASE_URL}/api/tags`);
  const models = Array.isArray(tags.data?.models) ? tags.data.models : [];
  const modelAvailable = models.some((model) => model?.name === DEFAULT_MODEL);
  return {
    reachable: tags.ok,
    status: tags.status,
    error: tags.error || null,
    models,
    modelAvailable,
  };
}

async function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryStartOllama(cliInfo) {
  if (!cliInfo.found) {
    return {
      started: false,
      attempted: false,
      message: 'Ollama CLI missing; cannot auto-start. Install/start Ollama manually.',
    };
  }

  try {
    const child = spawn('ollama', [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    await waitFor(5000);

    const api = await checkOllamaApi();
    return {
      started: api.reachable,
      attempted: true,
      message: api.reachable
        ? 'Ollama start attempted and API became reachable.'
        : 'Ollama start attempted but API still unreachable. Try launching Ollama manually.',
    };
  } catch (error) {
    return {
      started: false,
      attempted: true,
      message: `Ollama start attempt failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function getProcessCommandLine(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return null;

  if (process.platform === 'win32') {
    const result = run('powershell', [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${Math.trunc(pid)}" | Select-Object -ExpandProperty CommandLine)`,
    ]);

    if (!result.ok) return null;
    return result.stdout.trim() || null;
  }

  const result = run('ps', ['-p', String(Math.trunc(pid)), '-o', 'command=']);
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

export function isExpectedHqProcess(commandLine) {
  const text = String(commandLine || '').toLowerCase();
  return text.includes('rb-hq-server.mjs') && text.includes('serve');
}

export function canStopProcess({ pid, commandLine }) {
  return Number.isFinite(pid) && pid > 0 && isExpectedHqProcess(commandLine);
}

export function decideStartAction({ hqReachable, portOpen, portLooksLikeHq }) {
  if (hqReachable) {
    return { action: 'already-running', reason: 'HQ health endpoint already reachable.' };
  }
  if (portOpen && !portLooksLikeHq) {
    return { action: 'fail-port-occupied', reason: 'Port 4255 is occupied by a non-HQ service.' };
  }
  return { action: 'start-hq', reason: 'HQ not reachable; safe to launch runtime server.' };
}

export function buildUiUrl() {
  return `http://${HQ_HOST}:${HQ_PORT}/`;
}

function markdownSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

export function buildStatusWarnings(report) {
  const warnings = [];
  if (!report.ollamaApi?.reachable) warnings.push('Ollama API unreachable. Marcus will run degraded fallback mode.');
  if (!report.hq?.ok) warnings.push('HQ backend unreachable. Start with `pnpm rb:marcus:start`.');
  if (!report.memory?.indexAvailable) warnings.push('Memory index manifest missing. Run `pnpm rb:memory:index` if needed.');
  if (!report.bench?.ok) warnings.push('Bench evidence classifier failed or no bench runs found.');
  if (!report.control?.ok) warnings.push('Control-next returned nonzero; inspect control outputs.');
  return warnings;
}

async function gatherRuntimeReport(repoRoot, paths) {
  const gitStatus = run('git', ['status', '--short'], { cwd: repoRoot });
  const gitLog = run('git', ['log', '--oneline', '-1'], { cwd: repoRoot });

  const cliInfo = checkOllamaCli();
  const ollamaVersion = cliInfo.found ? getOllamaVersion() : null;
  const ollamaApi = await checkOllamaApi();

  const hq = await checkHqReachable();
  const memoryManifestPath = path.join(repoRoot, '.redbyte', 'agent', 'memory', 'index', 'manifest.json');
  const memoryManifest = fs.existsSync(memoryManifestPath)
    ? parseRuntimeState(fs.readFileSync(memoryManifestPath, 'utf8'))
    : null;

  const bench = runPnpm(repoRoot, 'rb:bench:evidence:classify');
  const control = runPnpm(repoRoot, 'rb:control:next');

  let writable = true;
  let writableError = null;
  try {
    fs.accessSync(paths.runtimeDir, fs.constants.W_OK);
  } catch (error) {
    writable = false;
    writableError = error instanceof Error ? error.message : String(error);
  }

  return {
    generatedAt: new Date().toISOString(),
    repoRoot,
    git: {
      clean: gitStatus.ok && gitStatus.stdout.trim().length === 0,
      statusShort: gitStatus.stdout.trim(),
      latestCommit: gitLog.stdout.trim(),
    },
    ollamaCli: cliInfo,
    ollamaVersion,
    ollamaApi,
    hq,
    memory: {
      indexAvailable: Boolean(memoryManifest),
      chunkCount: memoryManifest?.chunk_count ?? null,
      embeddedChunkCount: memoryManifest?.embedded_chunk_count ?? null,
    },
    bench: {
      ok: bench.ok,
      status: bench.status,
      stdout: bench.stdout.trim(),
      stderr: bench.stderr.trim(),
    },
    control: {
      ok: control.ok,
      status: control.status,
      stdout: control.stdout.trim(),
      stderr: control.stderr.trim(),
    },
    runtimeDirWritable: writable,
    runtimeDirError: writableError,
    hqUrl: `http://${HQ_HOST}:${HQ_PORT}`,
    uiUrl: buildUiUrl(),
  };
}

function writeHealthMarkdown(paths, report) {
  const warnings = buildStatusWarnings(report);
  const content = [
    '# Marcus Runtime Health',
    '',
    `- generated_at: ${report.generatedAt}`,
    `- marcus_url: ${report.uiUrl}`,
    `- hq_url: ${report.hqUrl}`,
    `- ui_url: ${report.uiUrl}`,
    '',
    markdownSection('Git', [
      `- clean: ${report.git.clean}`,
      `- latest_commit: ${report.git.latestCommit || 'unknown'}`,
      `- status_short: ${report.git.statusShort || 'clean'}`,
    ]),
    markdownSection('Ollama', [
      `- cli_found: ${report.ollamaCli.found}`,
      `- cli_path: ${report.ollamaCli.path || 'missing'}`,
      `- version: ${report.ollamaVersion || 'unknown'}`,
      `- api_reachable: ${report.ollamaApi.reachable}`,
      `- model_available(${DEFAULT_MODEL}): ${report.ollamaApi.modelAvailable}`,
    ]),
    markdownSection('HQ Backend', [
      `- reachable: ${report.hq.ok}`,
      `- health_status: ${report.hq.health?.status ?? 'unreachable'}`,
      `- snapshot_status: ${report.hq.snapshot?.status ?? 'unreachable'}`,
    ]),
    markdownSection('Memory / Evidence / Control', [
      `- memory_index_available: ${report.memory.indexAvailable}`,
      `- memory_chunk_count: ${report.memory.chunkCount ?? 'n/a'}`,
      `- bench_classifier_ok: ${report.bench.ok}`,
      `- control_next_ok: ${report.control.ok}`,
    ]),
    markdownSection('Warnings', warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- none']),
  ].join('\n');

  writeText(paths.healthMarkdown, content);
}

async function commandDoctor(repoRoot, paths) {
  const report = await gatherRuntimeReport(repoRoot, paths);
  writeHealthMarkdown(paths, report);
  info(`Health report written: ${path.relative(repoRoot, paths.healthMarkdown).replace(/\\/g, '/')}`);

  const warnings = buildStatusWarnings(report);
  info(`Marcus URL: ${report.uiUrl}`);
  info(`Ollama API reachable: ${report.ollamaApi.reachable}`);
  info(`HQ reachable: ${report.hq.ok}`);

  if (warnings.length > 0) {
    for (const warning of warnings) info(`warning: ${warning}`);
  }

  process.exit(report.hq.ok ? 0 : 1);
}

function startHqBackground(repoRoot, paths) {
  const logFd = fs.openSync(paths.serverLog, 'a');
  const child = spawn(process.execPath, ['scripts/rb-hq-server.mjs', 'serve'], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();

  fs.closeSync(logFd);
  fs.writeFileSync(paths.pidFile, `${child.pid}\n`, 'utf8');
  return child.pid;
}

async function waitForHqReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hq = await checkHqReachable();
    if (hq.ok) return true;
    await waitFor(500);
  }
  return false;
}

function readPid(paths) {
  try {
    const raw = fs.readFileSync(paths.pidFile, 'utf8').trim();
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function commandStart(repoRoot, paths) {
  const initialHq = await checkHqReachable();
  const portOpen = await isPortOpen(HQ_HOST, HQ_PORT);
  const existingPid = readPid(paths);
  const existingCmd = existingPid ? getProcessCommandLine(existingPid) : null;
  const portLooksLikeHq = initialHq.ok || isExpectedHqProcess(existingCmd);

  const startDecision = decideStartAction({
    hqReachable: initialHq.ok,
    portOpen,
    portLooksLikeHq,
  });

  if (startDecision.action === 'fail-port-occupied') {
    fail('Port 4255 is occupied by a non-HQ process.', [
      'Do not start Marcus runtime until the conflicting service is moved or stopped.',
      'You can still run `pnpm rb:marcus:doctor` for details.',
    ]);
  }

  const ollamaCli = checkOllamaCli();
  let ollamaApi = await checkOllamaApi();
  let ollamaStartAttempt = null;

  if (!ollamaApi.reachable) {
    ollamaStartAttempt = await tryStartOllama(ollamaCli);
    ollamaApi = await checkOllamaApi();
  }

  let launchedPid = existingPid;

  if (startDecision.action === 'start-hq') {
    launchedPid = startHqBackground(repoRoot, paths);
    const ready = await waitForHqReady();
    if (!ready) {
      const state = {
        lastStartAt: new Date().toISOString(),
        hqStarted: false,
        hqPid: launchedPid,
        ollamaReachable: ollamaApi.reachable,
        uiUrl: buildUiUrl(),
        warning: 'hq-start-timeout',
      };
      writeState(paths, state);
      fail('HQ server did not become healthy in time.', [
        `Log file: ${path.relative(repoRoot, paths.serverLog).replace(/\\/g, '/')}`,
        'Run `pnpm rb:marcus:doctor` for detailed status.',
      ]);
    }
  }

  const report = await gatherRuntimeReport(repoRoot, paths);
  const warnings = buildStatusWarnings(report);

  const startupMd = [
    '# Marcus Runtime Startup',
    '',
    `- generated_at: ${report.generatedAt}`,
    `- marcus_url: ${report.uiUrl}`,
    `- hq_url: ${report.hqUrl}`,
    `- ui_url: ${report.uiUrl}`,
    `- hq_pid: ${launchedPid || 'unknown'}`,
    `- hq_action: ${startDecision.action}`,
    `- ollama_api_reachable: ${report.ollamaApi.reachable}`,
    `- ollama_model_available(${DEFAULT_MODEL}): ${report.ollamaApi.modelAvailable}`,
    `- memory_index_available: ${report.memory.indexAvailable}`,
    `- bench_classifier_ok: ${report.bench.ok}`,
    `- control_next_ok: ${report.control.ok}`,
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- none']),
    '',
    '## Next actions',
    ...(report.ollamaApi.reachable
      ? [`- Open standalone Marcus: ${report.uiUrl}`]
      : ['- Start Ollama manually, then run `pnpm rb:marcus:status`.']),
  ].join('\n');

  writeText(paths.startupMarkdown, startupMd);

  writeState(paths, {
    lastStartAt: report.generatedAt,
    hqPid: launchedPid || null,
    hqUrl: report.hqUrl,
    uiUrl: report.uiUrl,
    hqReachable: report.hq.ok,
    ollamaReachable: report.ollamaApi.reachable,
    modelAvailable: report.ollamaApi.modelAvailable,
    memoryIndexAvailable: report.memory.indexAvailable,
    benchClassifierOk: report.bench.ok,
    controlNextOk: report.control.ok,
    hqAction: startDecision.action,
    ollamaStartAttempt,
    warnings,
    paths: {
      startupMarkdown: path.relative(repoRoot, paths.startupMarkdown).replace(/\\/g, '/'),
      healthMarkdown: path.relative(repoRoot, paths.healthMarkdown).replace(/\\/g, '/'),
      serverLog: path.relative(repoRoot, paths.serverLog).replace(/\\/g, '/'),
    },
  });

  info(`Marcus runtime ready check complete.`);
  info(`Marcus URL: ${report.uiUrl}`);
  info(`HQ PID: ${launchedPid || 'unknown'}`);
  info(`Ollama API: ${report.ollamaApi.reachable ? 'reachable' : 'unreachable'}`);
  info(`Memory index: ${report.memory.indexAvailable ? 'available' : 'missing'}`);
  info(`Bench evidence classifier: ${report.bench.ok ? 'ok' : 'degraded'}`);
  if (warnings.length > 0) {
    for (const warning of warnings) info(`warning: ${warning}`);
  }

  if (!report.ollamaApi.reachable) {
    info('Next action: launch Ollama manually (e.g. `ollama`) then run `pnpm rb:marcus:status`.');
  }
}

async function commandStop(repoRoot, paths) {
  const pid = readPid(paths);
  if (!pid) {
    info('No tracked HQ server PID found. Nothing to stop.');
    return;
  }

  const commandLine = getProcessCommandLine(pid);
  if (!canStopProcess({ pid, commandLine })) {
    fail('Refusing to stop process: identity check failed.', [
      `PID: ${pid}`,
      `CommandLine: ${commandLine || 'unknown'}`,
      'Only the launcher-started HQ process may be stopped.',
    ]);
  }

  try {
    process.kill(pid);
  } catch (error) {
    fail('Failed to stop HQ process.', [
      `PID: ${pid}`,
      error instanceof Error ? error.message : String(error),
    ]);
  }

  await waitFor(750);
  const stillRunning = Boolean(getProcessCommandLine(pid));
  if (stillRunning) {
    fail('HQ process still running after stop attempt.', [
      `PID: ${pid}`,
      'Check permissions and try again.',
    ]);
  }

  try {
    fs.rmSync(paths.pidFile, { force: true });
  } catch {
    // no-op
  }

  const state = readState(paths);
  writeState(paths, {
    ...state,
    lastStopAt: new Date().toISOString(),
    hqPid: null,
    hqReachable: false,
    hqAction: 'stopped',
  });

  info(`Stopped HQ server PID ${pid}.`);
  info('Ollama was not stopped (by design).');
}

async function commandStatus(repoRoot, paths) {
  const state = readState(paths);
  const hq = await checkHqReachable();
  const ollama = await checkOllamaApi();

  const report = {
    generatedAt: new Date().toISOString(),
    hqReachable: hq.ok,
    ollamaReachable: ollama.reachable,
    modelAvailable: ollama.modelAvailable,
    lastStartAt: state.lastStartAt || null,
    lastStopAt: state.lastStopAt || null,
    hqPid: state.hqPid || null,
    hqUrl: `http://${HQ_HOST}:${HQ_PORT}`,
    uiUrl: buildUiUrl(),
    runtimeFiles: {
      stateJson: path.relative(repoRoot, paths.stateJson).replace(/\\/g, '/'),
      pidFile: path.relative(repoRoot, paths.pidFile).replace(/\\/g, '/'),
      startupMarkdown: path.relative(repoRoot, paths.startupMarkdown).replace(/\\/g, '/'),
      healthMarkdown: path.relative(repoRoot, paths.healthMarkdown).replace(/\\/g, '/'),
      serverLog: path.relative(repoRoot, paths.serverLog).replace(/\\/g, '/'),
    },
  };

  const warnings = [];
  if (!report.hqReachable) warnings.push('HQ backend offline. Run `pnpm rb:marcus:start`.');
  if (!report.ollamaReachable) warnings.push('Ollama offline. Runtime can still operate in degraded mode.');
  if (report.ollamaReachable && !report.modelAvailable) warnings.push(`Configured model not found: ${DEFAULT_MODEL}`);

  info(`HQ reachable: ${report.hqReachable}`);
  info(`Ollama reachable: ${report.ollamaReachable}`);
  info(`Model (${DEFAULT_MODEL}) available: ${report.modelAvailable}`);
  info(`Last started: ${report.lastStartAt || 'unknown'}`);
  info(`Tracked HQ PID: ${report.hqPid || 'none'}`);
  info(`Marcus URL: ${report.uiUrl}`);
  info(`Runtime files: ${JSON.stringify(report.runtimeFiles)}`);
  if (warnings.length > 0) {
    for (const warning of warnings) info(`warning: ${warning}`);
  }
}

async function main() {
  const command = (process.argv[2] || 'doctor').toLowerCase();
  const repoRoot = resolveRepoRoot();
  const paths = resolveRuntimePaths(repoRoot);

  ensureRuntimeDir(paths);

  switch (command) {
    case 'doctor':
      await commandDoctor(repoRoot, paths);
      return;
    case 'start':
      await commandStart(repoRoot, paths);
      return;
    case 'stop':
      await commandStop(repoRoot, paths);
      return;
    case 'status':
      await commandStatus(repoRoot, paths);
      return;
    default:
      fail('Usage: node scripts/rb-marcus-runtime.mjs <start|stop|status|doctor>');
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryUrl) {
  void main();
}
