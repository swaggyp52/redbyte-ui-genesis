#!/usr/bin/env node

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  DEFAULT_MARCUS_BASE_URL,
  buildRepoSummaryPacket,
  packetSizeBytes,
  syncRepoSummary,
} from './rb-marcus-sync.mjs';

const CLOSEOUT_SCHEMA = 'redbyte-session-closeout-v1';
const DEFAULT_TIMEOUT_MS = 2500;
const SESSION_DIR_PARTS = ['.redbyte', 'session'];
const CLOSEOUT_JSON_NAME = 'latest-closeout.json';
const CLOSEOUT_MD_NAME = 'latest-closeout.md';
const DO_NOT_TOUCH_WARNINGS = [
  'Do not treat E2 as E3.',
  'Do not push unless explicitly told.',
  'Do not touch unrelated .agents/ or .codex/ files.',
];

const ALLOWED_GIT_COMMANDS = new Set([
  'rev-parse --show-toplevel',
  'rev-parse --abbrev-ref HEAD',
  'rev-parse --short=12 HEAD',
  'status --short',
  'log --oneline -1',
]);

function fail(message, details = []) {
  process.stderr.write(`[rb-session-close] [error] ${message}\n`);
  for (const detail of details) {
    if (!detail) continue;
    process.stderr.write(`${detail}\n`);
  }
  process.exit(1);
}

function safeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(items, limit = 8) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const text = safeText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

export function runAllowedGitCommand(rootDir, commandString) {
  if (!ALLOWED_GIT_COMMANDS.has(commandString)) {
    throw new Error(`Rejected git command: ${commandString}`);
  }
  const args = commandString.split(' ');
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function resolveRepoRoot(cwd = process.cwd()) {
  try {
    return runAllowedGitCommand(cwd, 'rev-parse --show-toplevel');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`rb-session-close must run inside a git repository. ${reason}`);
  }
}

function gitValue(rootDir, commandString, fallback = '', gitRunner = runAllowedGitCommand) {
  try {
    return gitRunner(rootDir, commandString);
  } catch {
    return fallback;
  }
}

function statusLines(rootDir, gitRunner = runAllowedGitCommand) {
  const raw = gitValue(rootDir, 'status --short', '', gitRunner);
  return raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export function collectRepoState(rootDir, gitRunner = runAllowedGitCommand) {
  const lines = statusLines(rootDir, gitRunner);
  const dirty = lines.length > 0;
  return {
    branch: gitValue(rootDir, 'rev-parse --abbrev-ref HEAD', 'unknown', gitRunner),
    commit: gitValue(rootDir, 'rev-parse --short=12 HEAD', 'unknown', gitRunner),
    latest_commit_line: gitValue(rootDir, 'log --oneline -1', 'unknown', gitRunner),
    dirty,
    status_short: lines,
    untracked_count: lines.filter((line) => line.startsWith('?? ')).length,
  };
}

function normalizeBaseUrl(baseUrl) {
  const value = safeText(baseUrl || DEFAULT_MARCUS_BASE_URL).replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) {
    throw new Error(`Invalid MARCUS_BASE_URL: ${value}`);
  }
  return value;
}

export async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available. Use Node 20+ or provide fetchImpl.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkMarcusPing({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const url = `${normalizeBaseUrl(baseUrl)}/ping`;
  try {
    const response = await fetchWithTimeout(fetchImpl, url, { method: 'GET' }, timeoutMs);
    return { reachable: response.ok, status: response.status, error: null };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractQueueFromPacket(packet) {
  const next = uniqueStrings(packet?.next_recommended_work || [], 8);
  const blocked = uniqueStrings(packet?.active_blockers || [], 8);
  return { nextWork: next, blockedWork: blocked };
}

export function detectNextWorkSource(rootDir) {
  const controlPath = path.join(rootDir, '.redbyte', 'agent', 'runs', 'control-next-latest.json');
  if (!fs.existsSync(controlPath)) {
    return {
      source: 'none',
      recommended_slice: null,
      detail: 'control-next output not found',
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
    return {
      source: '.redbyte/agent/runs/control-next-latest.json',
      recommended_slice: safeText(parsed.recommended_next_product_slice || ''),
      detail: safeText(parsed.why_this_task_matters || ''),
    };
  } catch {
    return {
      source: '.redbyte/agent/runs/control-next-latest.json',
      recommended_slice: null,
      detail: 'control-next output unreadable',
    };
  }
}

function ensureSessionDir(rootDir) {
  const dir = path.join(rootDir, ...SESSION_DIR_PARTS);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensurePathInsideSessionDir(rootDir, candidatePath) {
  const sessionDir = path.resolve(path.join(rootDir, ...SESSION_DIR_PARTS));
  const resolved = path.resolve(candidatePath);
  const rel = path.relative(sessionDir, resolved);
  const inside = !(rel.startsWith('..') || path.isAbsolute(rel));
  if (!inside) {
    throw new Error(`Refusing to write outside ${SESSION_DIR_PARTS.join(path.sep)}: ${resolved}`);
  }
}

function summarizePacket(packet) {
  const summary = safeText(packet?.summary || '');
  if (!summary) return 'No packet summary available.';
  return summary;
}

async function verifyMarcusReadEndpoints({ baseUrl, fetchImpl, timeoutMs }) {
  const checks = [
    { key: 'product_state', path: '/product-state' },
    { key: 'next_work', path: '/next-work' },
  ];
  const result = {};
  for (const check of checks) {
    try {
      const response = await fetchWithTimeout(fetchImpl, `${baseUrl}${check.path}`, { method: 'GET' }, timeoutMs);
      result[check.key] = response.ok;
    } catch {
      result[check.key] = false;
    }
  }
  return result;
}

export async function buildCloseoutReport({
  rootDir = process.cwd(),
  now = new Date(),
  baseUrl = process.env.MARCUS_BASE_URL || DEFAULT_MARCUS_BASE_URL,
  token = process.env.MARCUS_TOKEN,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  packetBuilder = buildRepoSummaryPacket,
  syncImpl = syncRepoSummary,
  gitRunner = runAllowedGitCommand,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const repo = collectRepoState(rootDir, gitRunner);

  let packet;
  let packetGenerated = false;
  let packetError = null;
  try {
    packet = packetBuilder({
      rootDir,
      now,
      gitInfo: {
        branch: repo.branch,
        commit: repo.commit,
      },
    });
    packetGenerated = true;
  } catch (error) {
    packetError = error instanceof Error ? error.message : String(error);
    packet = null;
  }

  const ping = await checkMarcusPing({ baseUrl: normalizedBaseUrl, fetchImpl, timeoutMs });
  const tokenPresent = Boolean(token && safeText(token));
  const marcus = {
    base_url: normalizedBaseUrl,
    reachable: ping.reachable,
    token_present: tokenPresent,
    sync_attempted: false,
    sync_succeeded: false,
    error: null,
    ping_status: ping.status,
    verification: {
      product_state: false,
      next_work: false,
    },
  };

  if (!tokenPresent) {
    marcus.error = 'Marcus sync skipped: missing token.';
  } else if (!ping.reachable) {
    marcus.error = 'Marcus sync skipped/failed: unreachable.';
  } else if (!packetGenerated) {
    marcus.error = 'Marcus sync skipped/failed: packet generation failed.';
  } else {
    marcus.sync_attempted = true;
    try {
      await syncImpl({
        baseUrl: normalizedBaseUrl,
        token,
        packet,
        fetchImpl: async (url, options) => fetchWithTimeout(fetchImpl, url, options, timeoutMs),
      });
      marcus.sync_succeeded = true;
      marcus.verification = await verifyMarcusReadEndpoints({
        baseUrl: normalizedBaseUrl,
        fetchImpl,
        timeoutMs,
      });
    } catch (error) {
      marcus.error = safeText(error instanceof Error ? error.message : String(error)) || 'Marcus sync skipped/failed: unreachable.';
    }
  }

  const queue = extractQueueFromPacket(packet || {});
  const nextWorkSource = detectNextWorkSource(rootDir);

  const closeout = {
    schema: CLOSEOUT_SCHEMA,
    generated_at: now.toISOString(),
    repo: {
      branch: repo.branch,
      commit: repo.commit,
      latest_commit_line: repo.latest_commit_line,
      dirty: repo.dirty,
      status_short: repo.status_short,
      untracked_count: repo.untracked_count,
      clean: !repo.dirty,
    },
    marcus,
    packet: {
      generated: packetGenerated,
      size_bytes: packetGenerated && packet ? packetSizeBytes(packet) : 0,
      summary: packetGenerated && packet ? summarizePacket(packet) : 'Packet generation failed.',
      error: packetError,
    },
    next_work_source: nextWorkSource,
    next_work: queue.nextWork,
    blocked_work: queue.blockedWork,
    warnings: DO_NOT_TOUCH_WARNINGS,
  };

  return closeout;
}

function renderCloseoutMarkdown(closeout) {
  const repo = closeout.repo;
  const marcus = closeout.marcus;
  const packet = closeout.packet;

  const lines = [
    '# RedByte Session Closeout',
    '',
    `Generated: ${closeout.generated_at}`,
    '',
    '## Repo',
    '',
    `- Branch: ${repo.branch}`,
    `- Commit: ${repo.commit}`,
    `- Latest commit: ${repo.latest_commit_line}`,
    `- Dirty: ${repo.dirty ? 'yes' : 'no'}`,
    `- Status paths: ${repo.status_short.length}`,
    '',
    '## Marcus',
    '',
    `- Base URL: ${marcus.base_url}`,
    `- Reachable (/ping): ${marcus.reachable ? 'yes' : 'no'}`,
    `- Token present: ${marcus.token_present ? 'yes' : 'no'}`,
    `- Sync attempted: ${marcus.sync_attempted ? 'yes' : 'no'}`,
    `- Sync succeeded: ${marcus.sync_succeeded ? 'yes' : 'no'}`,
    `- Verification /product-state: ${marcus.verification.product_state ? 'ok' : 'no'}`,
    `- Verification /next-work: ${marcus.verification.next_work ? 'ok' : 'no'}`,
    `- Error: ${marcus.error || 'none'}`,
    '',
    '## Packet',
    '',
    `- Generated: ${packet.generated ? 'yes' : 'no'}`,
    `- Size bytes: ${packet.size_bytes}`,
    `- Summary: ${packet.summary}`,
    `- Error: ${packet.error || 'none'}`,
    '',
    '## Next Work Source',
    '',
    `- Source: ${closeout.next_work_source.source}`,
    `- Recommended slice: ${closeout.next_work_source.recommended_slice || 'none'}`,
    `- Detail: ${closeout.next_work_source.detail || 'none'}`,
    '',
    '## Next Work',
    '',
    ...((closeout.next_work.length ? closeout.next_work : ['none']).map((item) => `- ${item}`)),
    '',
    '## Blocked Work',
    '',
    ...((closeout.blocked_work.length ? closeout.blocked_work : ['none']).map((item) => `- ${item}`)),
    '',
    '## Warnings',
    '',
    ...closeout.warnings.map((item) => `- ${item}`),
    '',
  ];

  return lines.join('\n');
}

export function writeCloseoutFiles(rootDir, closeout) {
  const sessionDir = ensureSessionDir(rootDir);
  const jsonPath = path.join(sessionDir, CLOSEOUT_JSON_NAME);
  const mdPath = path.join(sessionDir, CLOSEOUT_MD_NAME);
  ensurePathInsideSessionDir(rootDir, jsonPath);
  ensurePathInsideSessionDir(rootDir, mdPath);

  fs.writeFileSync(jsonPath, `${JSON.stringify(closeout, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderCloseoutMarkdown(closeout), 'utf8');

  return {
    jsonPath,
    markdownPath: mdPath,
  };
}

function printStatus(status) {
  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
}

export async function statusCommand({
  rootDir = process.cwd(),
  baseUrl = process.env.MARCUS_BASE_URL || DEFAULT_MARCUS_BASE_URL,
  token = process.env.MARCUS_TOKEN,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  gitRunner = runAllowedGitCommand,
} = {}) {
  const repo = collectRepoState(rootDir, gitRunner);
  const ping = await checkMarcusPing({ baseUrl, fetchImpl, timeoutMs });

  let packetGenerated = false;
  let packetError = null;
  try {
    buildRepoSummaryPacket({
      rootDir,
      now: new Date('2000-01-01T00:00:00.000Z'),
      gitInfo: { branch: repo.branch, commit: repo.commit },
    });
    packetGenerated = true;
  } catch (error) {
    packetError = safeText(error instanceof Error ? error.message : String(error));
  }

  const status = {
    schema: 'redbyte-session-status-v1',
    generated_at: new Date().toISOString(),
    repo: {
      branch: repo.branch,
      latest_commit: repo.latest_commit_line,
      dirty: repo.dirty,
      status_short: repo.status_short,
      untracked_count: repo.untracked_count,
    },
    marcus: {
      base_url: normalizeBaseUrl(baseUrl),
      reachable: ping.reachable,
      ping_status: ping.status,
      token_present: Boolean(token && safeText(token)),
      error: ping.error,
    },
    packet: {
      can_generate: packetGenerated,
      error: packetError,
    },
    next_work_source: detectNextWorkSource(rootDir),
  };

  printStatus(status);
  return status;
}

export async function closeCommand({
  rootDir = process.cwd(),
  baseUrl = process.env.MARCUS_BASE_URL || DEFAULT_MARCUS_BASE_URL,
  token = process.env.MARCUS_TOKEN,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date(),
} = {}) {
  const closeout = await buildCloseoutReport({
    rootDir,
    now,
    baseUrl,
    token,
    fetchImpl,
    timeoutMs,
  });

  const files = writeCloseoutFiles(rootDir, closeout);
  const summary = {
    schema: 'redbyte-session-close-result-v1',
    closeout_schema: closeout.schema,
    generated_at: closeout.generated_at,
    report_json: path.relative(rootDir, files.jsonPath).replace(/\\/g, '/'),
    report_markdown: path.relative(rootDir, files.markdownPath).replace(/\\/g, '/'),
    repo_dirty: closeout.repo.dirty,
    marcus: {
      reachable: closeout.marcus.reachable,
      token_present: closeout.marcus.token_present,
      sync_attempted: closeout.marcus.sync_attempted,
      sync_succeeded: closeout.marcus.sync_succeeded,
      status: closeout.marcus.error || (closeout.marcus.sync_succeeded ? 'Marcus sync complete.' : 'Marcus local closeout complete.'),
    },
    next_work_count: closeout.next_work.length,
    blocked_work_count: closeout.blocked_work.length,
  };

  printStatus(summary);
  return { closeout, summary, files };
}

export async function selfTest() {
  const rootDir = resolveRepoRoot(process.cwd());
  const closeout = await buildCloseoutReport({
    rootDir,
    now: new Date('2026-01-01T00:00:00.000Z'),
    token: '',
    fetchImpl: async () => {
      throw new Error('offline-self-test');
    },
    timeoutMs: 50,
  });

  if (closeout.schema !== CLOSEOUT_SCHEMA) {
    throw new Error('Self-test failed: invalid closeout schema.');
  }
  if (!Array.isArray(closeout.repo.status_short)) {
    throw new Error('Self-test failed: repo status_short missing.');
  }
  if (closeout.marcus.token_present) {
    throw new Error('Self-test failed: token should be absent.');
  }
  if (!closeout.packet.generated) {
    throw new Error('Self-test failed: packet generation failed unexpectedly.');
  }
  if (closeout.marcus.error !== 'Marcus sync skipped: missing token.') {
    throw new Error('Self-test failed: missing token degradation not reported.');
  }

  process.stdout.write('[rb-session-close] [ok] self-test passed\n');
}

export function parseCommand(argv = process.argv.slice(2)) {
  const command = safeText(argv[0] || 'close').toLowerCase();
  if (['status', 'close', 'test'].includes(command)) {
    return command;
  }
  throw new Error('Usage: node scripts/rb-session-close.mjs <status|close|test>');
}

async function main(argv = process.argv.slice(2)) {
  const command = parseCommand(argv);
  const rootDir = resolveRepoRoot(process.cwd());

  if (command === 'status') {
    await statusCommand({ rootDir });
    return;
  }

  if (command === 'close') {
    await closeCommand({ rootDir });
    return;
  }

  if (command === 'test') {
    await selfTest();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    fail(message);
  });
}

export {
  ALLOWED_GIT_COMMANDS,
  CLOSEOUT_SCHEMA,
  DO_NOT_TOUCH_WARNINGS,
};
