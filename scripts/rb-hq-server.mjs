#!/usr/bin/env node

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarcusToolRegistry } from './marcus/marcus-tool-registry.mjs';
import { runMarcusAgentLoop } from './marcus/marcus-agent-loop.mjs';
import { savePacket, listPackets, readPacket } from './marcus/marcus-packet-store.mjs';
import { appendEvent, listEvents, clearEvents } from './marcus/marcus-session-store.mjs';
import { createTaskFromPacket, listTasks, readTask, updateTaskStatus } from './marcus/marcus-task-queue.mjs';
import {
  generatePatchProposal,
  listPatchProposals,
  readCodeFile,
  readPatchProposal,
  searchCode,
} from './marcus/marcus-code-intelligence.mjs';
import { buildMarcusStandaloneHtml } from './marcus/marcus-standalone-page.mjs';

const DEFAULT_PORT = Number(process.env.REDBYTE_HQ_PORT || 4255);
const HOST = '127.0.0.1';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const REDBYTE_AGENT_MODEL = process.env.REDBYTE_AGENT_MODEL || 'qwen2.5-coder:1.5b';
const REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES = String(process.env.REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES || 'false').toLowerCase() === 'true';
const MAX_BODY_BYTES = 64 * 1024;
const OLLAMA_TIMEOUT_MS = Number(process.env.REDBYTE_HQ_OLLAMA_TIMEOUT_MS || 30000);

const REPO_ROOT = resolveRepoRoot();
const PACKETS_DIR = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'hq', 'packets');
const SESSION_DIR = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'hq', 'session');
const TASKS_DIR = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'hq', 'tasks');
const PATCH_PROPOSALS_DIR = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'hq', 'patch-proposals');
const CONTROL_NEXT_JSON = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'control-next-latest.json');
const CLAIMS_TRACE_JSON = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'product-claims-trace-latest.json');
const PROBLEM_PACKET_JSON = path.join(REPO_ROOT, '.redbyte', 'agent', 'runs', 'problems', 'problem-latest.json');
const MEMORY_INDEX_MANIFEST = path.join(REPO_ROOT, '.redbyte', 'agent', 'memory', 'index', 'manifest.json');
const BENCH_RUNS_ROOT = path.join(REPO_ROOT, '.redbyte', 'bench', 'runs');

const ALLOWLISTED_COMMANDS = new Set([
  'control-next',
  'control-trace-claims',
  'memory-search',
  'memory-synth',
  'memory-sync-plan',
  'problem-intake',
  'problem-trace',
  'problem-prompt',
  'bench-evidence-classify',
  'agent-ollama-doctor',
  'work-status',
  'trace-claim',
  'validate-docs',
  'encoding-check',
  'git-status-short',
]);

export function isAllowlistedCommandId(commandId) {
  return ALLOWLISTED_COMMANDS.has(commandId);
}

function resolveRepoRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.status === 0) {
    return result.stdout.trim();
  }
  return process.cwd();
}

function pnpmExecutable() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function runCommand(command, args) {
  const child = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return {
    status: child.status ?? 1,
    stdout: child.stdout || '',
    stderr: child.stderr || '',
    ok: (child.status ?? 1) === 0,
  };
}

export function sanitizeUserText(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 1200);
}

export function runAllowlistedCommand(commandId, payload = '') {
  if (!isAllowlistedCommandId(commandId)) {
    throw new Error(`Command not allowlisted: ${commandId}`);
  }

  const pnpm = pnpmExecutable();
  const safePayload = sanitizeUserText(payload);

  switch (commandId) {
    case 'control-next':
      return runCommand(pnpm, ['rb:control:next']);
    case 'control-trace-claims':
      return runCommand(pnpm, ['rb:control:trace-claims']);
    case 'memory-search':
      return runCommand(pnpm, ['rb:memory:search', '--', safePayload || 'RedByte product truth']);
    case 'memory-synth':
      return runCommand(pnpm, ['rb:memory:synth', '--', safePayload || 'What is RedByte right now?']);
    case 'memory-sync-plan':
      return runCommand(pnpm, ['rb:memory:sync-plan']);
    case 'problem-intake':
      return runCommand(pnpm, ['rb:problem:intake', '--', safePayload || 'No feedback provided.']);
    case 'problem-trace':
      return runCommand(pnpm, ['rb:problem:trace']);
    case 'problem-prompt':
      return runCommand(pnpm, ['rb:problem:prompt']);
    case 'bench-evidence-classify':
      return runCommand(pnpm, ['rb:bench:evidence:classify']);
    case 'agent-ollama-doctor':
      return runCommand(pnpm, ['rb:agent:ollama:doctor']);
    case 'work-status':
      return runCommand(pnpm, ['rb:work:status']);
    case 'trace-claim':
      return runCommand(pnpm, ['rb:memory:trace', '--', safePayload || 'Draft export is not trusted export']);
    case 'validate-docs':
      return runCommand(pnpm, ['rb:doc:validate']);
    case 'encoding-check':
      return runCommand(pnpm, ['rb:encoding:check']);
    case 'git-status-short':
      return runCommand('git', ['status', '--short']);
    default:
      throw new Error(`Unhandled allowlisted command: ${commandId}`);
  }
}

function readJsonMaybe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readTextMaybe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function clipExcerpt(value, limit = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit) || null;
}

function commandSources(commandId, excerpt, overrides = {}) {
  const defaults = {
    kind: 'tool_output',
    title: commandId,
    path: null,
    freshness: 'generated',
    authority: 'supporting',
  };
  return [{
    id: `${commandId}-source`,
    ...defaults,
    ...overrides,
    excerpt: clipExcerpt(excerpt),
  }];
}

function gitSummary() {
  const status = runCommand('git', ['status', '--short']);
  const latest = runCommand('git', ['log', '--oneline', '-1']);
  return {
    clean: status.ok && status.stdout.trim().length === 0,
    status_short: status.stdout.trim(),
    latest_commit: latest.stdout.trim(),
  };
}

function latestBenchRunDir() {
  if (!fs.existsSync(BENCH_RUNS_ROOT)) return null;
  const dirs = fs
    .readdirSync(BENCH_RUNS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (dirs.length === 0) return null;
  return path.join(BENCH_RUNS_ROOT, dirs[dirs.length - 1]);
}

function loadBenchEvidenceSummary() {
  const runDir = latestBenchRunDir();
  if (!runDir) return { available: false, message: 'No bench runs found.' };

  const classificationPath = path.join(runDir, 'evidence-classification.json');
  const classification = readJsonMaybe(classificationPath);
  if (!classification?.targets) {
    return {
      available: false,
      run_folder: relative(runDir),
      message: 'No evidence classification json found.',
    };
  }

  const counts = { E0: 0, E1: 0, E2: 0, E3: 0 };
  for (const target of classification.targets) {
    if (counts[target.evidence_level] !== undefined) {
      counts[target.evidence_level] += 1;
    }
  }

  return {
    available: true,
    run_folder: classification.run_folder || relative(runDir),
    generated_at: classification.generated_at,
    counts,
    targets: classification.targets.map((target) => ({
      target_id: target.target_id,
      evidence_level: target.evidence_level,
      observed_behavior_status: target.observed_behavior_status,
      warning_classes: target.warning_classes,
    })),
  };
}

function createEmptyBenchTimeline(message = 'No bench runs found.') {
  return {
    available: false,
    runs: [],
    targets: [],
    counts: { E0: 0, E1: 0, E2: 0, E3: 0 },
    warningClasses: {},
    latestRunFolder: null,
    currentBlockerSummary: message,
    manualObservationNeededCount: 0,
    message,
  };
}

function loadBenchTimeline() {
  if (!fs.existsSync(BENCH_RUNS_ROOT)) {
    return createEmptyBenchTimeline('No local bench run folder exists. E3 proof remains manual-observation gated.');
  }

  const runDirs = fs
    .readdirSync(BENCH_RUNS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(BENCH_RUNS_ROOT, entry.name))
    .sort();

  if (runDirs.length === 0) {
    return createEmptyBenchTimeline('Bench runs directory exists but contains no runs.');
  }

  const runs = [];
  const latestTargets = [];
  const counts = { E0: 0, E1: 0, E2: 0, E3: 0 };
  const warningClasses = {};
  let manualObservationNeededCount = 0;

  for (const runDir of runDirs) {
    const classificationPath = path.join(runDir, 'evidence-classification.json');
    const classification = readJsonMaybe(classificationPath);
    const runCounts = { E0: 0, E1: 0, E2: 0, E3: 0 };
    const targets = Array.isArray(classification?.targets) ? classification.targets : [];

    for (const target of targets) {
      const level = target.evidence_level;
      if (runCounts[level] !== undefined) runCounts[level] += 1;
      for (const warningClass of target.warning_classes || []) {
        warningClasses[warningClass] = (warningClasses[warningClass] || 0) + 1;
      }
      const needsObservation =
        level === 'E2' ||
        /uncertain|pending|manual|not observed/i.test(String(target.observed_behavior_status || '')) ||
        (Array.isArray(target.blockers) && target.blockers.some((blocker) => /observe|manual|E3/i.test(String(blocker))));
      if (needsObservation) manualObservationNeededCount += 1;
    }

    runs.push({
      runFolder: relative(runDir),
      generatedAt: classification?.generated_at || null,
      targetCount: targets.length,
      counts: runCounts,
      warningClasses: Object.fromEntries(
        Object.entries(warningClasses)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, 12)
      ),
      hasClassification: Boolean(classification),
    });
  }

  const latestRunDir = runDirs[runDirs.length - 1];
  const latestClassification = readJsonMaybe(path.join(latestRunDir, 'evidence-classification.json'));
  const latestRunTargets = Array.isArray(latestClassification?.targets) ? latestClassification.targets : [];
  for (const target of latestRunTargets) {
    const level = target.evidence_level;
    if (counts[level] !== undefined) counts[level] += 1;
    latestTargets.push({
      target_id: target.target_id,
      evidence_level: level,
      observed_behavior_status: target.observed_behavior_status,
      warning_classes: Array.isArray(target.warning_classes) ? target.warning_classes : [],
      blockers: Array.isArray(target.blockers) ? target.blockers : [],
      recommended_next_action: target.recommended_next_action || null,
    });
  }

  const currentBlockerSummary = manualObservationNeededCount > 0
    ? `${manualObservationNeededCount} target observation record(s) still need manual E3 review across local runs.`
    : 'No manual E3 observation blockers detected in local classifications.';

  return {
    available: true,
    runs: runs.slice(-10).reverse(),
    targets: latestTargets,
    counts,
    warningClasses,
    latestRunFolder: relative(latestRunDir),
    currentBlockerSummary,
    manualObservationNeededCount,
  };
}

async function ollamaReachable() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildMarcusSystemPrompt() {
  return [
    'You are Marcus, RedByte\'s local engineering intelligence.',
    'You are direct, technical, evidence-focused, and product-aware.',
    'You protect RedByte truth boundaries.',
    'Never conflate E2 board programming with E3 observed board behavior.',
    'Never conflate Map Pins completion with Verify proof.',
    'Never conflate Draft Export with Trusted Export.',
    'If asked to fix or change code, generate a proposal-only packet. Do not edit, apply patches, stage, commit, or push.',
    'Keep answers concise, actionable, and tied to evidence.',
  ].join(' ');
}

async function callOllamaChat({ messages, tools }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: REDBYTE_AGENT_MODEL,
        stream: false,
        messages,
        ...(tools ? { tools } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `Ollama returned ${response.status}` };
    }

    const payload = await response.json();
    const message = payload?.message;
    const content = message?.content;
    const tool_calls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    if (typeof content !== 'string' && tool_calls.length === 0) {
      return { ok: false, error: 'Ollama response had no usable content or tool call.' };
    }

    return { ok: true, message: { content: typeof content === 'string' ? content : '', tool_calls } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

const marcusToolRegistry = createMarcusToolRegistry({
  repoRoot: REPO_ROOT,
  sanitizeUserText,
  runAllowlistedCommand,
  buildSnapshot,
  loadBenchEvidenceSummary,
  gitSummary,
  searchCode: (query, options) => searchCode(REPO_ROOT, query, options),
  readCodeFile: (filePath, options) => readCodeFile(REPO_ROOT, filePath, options),
  generatePatchProposal: ({ taskId = null, packetId = null, rawRequest = '', likelyFiles = [] } = {}) => {
    const task = taskId ? readTask(taskId, TASKS_DIR) : null;
    const packet = packetId ? readPacket(packetId, PACKETS_DIR) : null;
    return generatePatchProposal(REPO_ROOT, { task, packet, taskId, packetId, rawRequest, likelyFiles }, PATCH_PROPOSALS_DIR);
  },
  listPatchProposals: (options) => listPatchProposals(REPO_ROOT, options, PATCH_PROPOSALS_DIR),
});

async function buildHealth() {
  const git = gitSummary();
  const ollama_online = await ollamaReachable();
  const memory_manifest = readJsonMaybe(MEMORY_INDEX_MANIFEST);
  return {
    status: 'ok',
    server: {
      host: HOST,
      port: DEFAULT_PORT,
      repo_root: REPO_ROOT,
    },
    agent: {
      name: 'Marcus',
      model: REDBYTE_AGENT_MODEL,
      ollama_base_url: OLLAMA_BASE_URL,
      ollama_online,
    },
    memory: {
      allow_obsidian_writes: REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES,
      index_available: Boolean(memory_manifest),
      chunk_count: memory_manifest?.chunk_count ?? null,
      embedded_chunk_count: memory_manifest?.embedded_chunk_count ?? null,
    },
    git,
  };
}

function loadControlNext() {
  return readJsonMaybe(CONTROL_NEXT_JSON);
}

async function buildSnapshot() {
  const controlResult = runAllowlistedCommand('control-next');
  const controlNext = loadControlNext();
  const claimsTrace = readJsonMaybe(CLAIMS_TRACE_JSON);
  const evidence = loadBenchEvidenceSummary();

  return {
    generated_at: new Date().toISOString(),
    control_next_ok: controlResult.ok,
    control_next: controlNext,
    claims_trace_summary: claimsTrace?.summary ?? null,
    bench_evidence: evidence,
    blocked_task:
      controlNext?.recommended_next_product_slice ??
      'Finish honest proof closure: golden E3, custom-row E2/E3, certification matrix',
  };
}

function relative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

/**
 * Try to save a workbench packet. Never throws — save failures warn only.
 * @param {object} packet
 * @returns {string|null} saved packet id, or null on failure
 */
function trySavePacket(packet) {
  try {
    const saved = savePacket(packet, PACKETS_DIR);
    return saved.id;
  } catch (err) {
    console.warn('[hq] packet save failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Try to append a session event. Never throws — append failures warn only.
 * @param {object} event
 * @returns {object|null} normalized event, or null on failure
 */
function tryAppendEvent(event) {
  try {
    return appendEvent(event, SESSION_DIR);
  } catch (err) {
    console.warn('[hq] session event append failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function withCors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function respondJson(res, statusCode, payload) {
  withCors(res);
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function respondHtml(res, statusCode, html) {
  const body = String(html || '');
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Request body too large. Limit is ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });

    req.on('error', reject);
  });
}

export function createHqServer() {
  return createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      withCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${HOST}:${DEFAULT_PORT}`);

    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/marcus' || url.pathname === '/marcus/')) {
        respondHtml(res, 200, buildMarcusStandaloneHtml());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/session/events') {
        const limitParam = Number(url.searchParams.get('limit') || 20);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 20;
        const type = url.searchParams.get('type') || undefined;
        const events = listEvents({ limit, type }, SESSION_DIR);
        respondJson(res, 200, { ok: true, events, total: events.length });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/session/clear') {
        clearEvents(SESSION_DIR);
        respondJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/packets') {
        const limitParam = Number(url.searchParams.get('limit') || 20);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;
        const type = url.searchParams.get('type') || undefined;
        const packets = listPackets({ limit, type }, PACKETS_DIR);
        respondJson(res, 200, { ok: true, packets, total: packets.length });
        return;
      }

      const packetIdMatch = url.pathname.match(/^\/packets\/([^/]+)$/);
      if (req.method === 'GET' && packetIdMatch) {
        try {
          const packet = readPacket(packetIdMatch[1], PACKETS_DIR);
          respondJson(res, 200, { ok: true, packet });
        } catch (err) {
          respondJson(res, 404, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/tasks') {
        const limitParam = Number(url.searchParams.get('limit') || 20);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;
        const status = url.searchParams.get('status') || undefined;
        const tasks = listTasks({ limit, status }, TASKS_DIR);
        respondJson(res, 200, { ok: true, tasks, total: tasks.length });
        return;
      }

      const taskIdMatch = url.pathname.match(/^\/tasks\/([^/]+)$/);
      if (req.method === 'GET' && taskIdMatch) {
        try {
          const task = readTask(taskIdMatch[1], TASKS_DIR);
          respondJson(res, 200, { ok: true, task });
        } catch (err) {
          respondJson(res, 404, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/tasks/from-packet') {
        const body = await readBody(req);
        const packetId = sanitizeUserText(body?.packetId || body?.packet_id || '');
        if (!packetId) {
          respondJson(res, 400, { ok: false, error: 'packetId is required.' });
          return;
        }
        try {
          const packet = readPacket(packetId, PACKETS_DIR);
          const task = createTaskFromPacket(packet, TASKS_DIR);
          tryAppendEvent({
            type: 'runtime_status',
            title: `Task promoted: ${task.title}`,
            summary: `Packet ${packet.id} promoted to operator task ${task.id}.`,
            severity: 'success',
            packetId: packet.id,
            metadata: { taskId: task.id, status: task.status },
          });
          respondJson(res, 200, { ok: true, task });
        } catch (err) {
          respondJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/code/search') {
        const query = sanitizeUserText(url.searchParams.get('q') || url.searchParams.get('query') || '');
        if (!query) {
          respondJson(res, 400, { ok: false, error: 'q is required.' });
          return;
        }
        try {
          const result = searchCode(REPO_ROOT, query, { maxSnippets: 20 });
          respondJson(res, 200, { ok: true, ...result });
        } catch (err) {
          respondJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/code/file') {
        const filePath = sanitizeUserText(url.searchParams.get('path') || '');
        if (!filePath) {
          respondJson(res, 400, { ok: false, error: 'path is required.' });
          return;
        }
        try {
          const file = readCodeFile(REPO_ROOT, filePath, { maxChars: 12000 });
          respondJson(res, 200, { ok: true, file });
        } catch (err) {
          respondJson(res, 403, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/patch-proposals') {
        const limitParam = Number(url.searchParams.get('limit') || 20);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;
        const proposals = listPatchProposals(REPO_ROOT, { limit }, PATCH_PROPOSALS_DIR);
        respondJson(res, 200, { ok: true, proposals, total: proposals.length });
        return;
      }

      const proposalIdMatch = url.pathname.match(/^\/patch-proposals\/([^/]+)$/);
      if (req.method === 'GET' && proposalIdMatch) {
        try {
          const proposal = readPatchProposal(REPO_ROOT, proposalIdMatch[1], PATCH_PROPOSALS_DIR);
          respondJson(res, 200, { ok: true, proposal });
        } catch (err) {
          respondJson(res, 404, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/patch-proposals') {
        const body = await readBody(req);
        const taskId = sanitizeUserText(body?.taskId || body?.task_id || '');
        const packetId = sanitizeUserText(body?.packetId || body?.packet_id || '');
        const rawRequest = sanitizeUserText(body?.rawRequest || body?.raw_request || '');
        try {
          const task = taskId ? readTask(taskId, TASKS_DIR) : null;
          const packet = packetId ? readPacket(packetId, PACKETS_DIR) : null;
          const proposal = generatePatchProposal(REPO_ROOT, {
            task,
            packet,
            taskId: taskId || null,
            packetId: packetId || null,
            rawRequest,
            likelyFiles: Array.isArray(body?.likelyFiles) ? body.likelyFiles.slice(0, 12).map(String) : [],
          }, PATCH_PROPOSALS_DIR);

          const proposalPacketId = trySavePacket({
            type: 'patch_proposal',
            title: proposal.title,
            summary: proposal.productProblem,
            prompt: rawRequest || task?.codexPrompt || packet?.prompt || proposal.title,
            reply: proposal.patchSketch,
            mode: 'patch-proposal',
            toolsUsed: [{ name: 'generate_patch_proposal', ok: true, summary: 'Proposal-only patch plan generated.' }],
            sources: proposal.evidenceSources,
            evidenceLevel: task?.evidenceLevel || packet?.evidenceLevel || 'E0',
            sourceConfidence: task?.sourceConfidence || packet?.sourceConfidence || 'medium',
            generatedFiles: proposal.generatedFiles,
            warnings: proposal.risks,
            recommendedAction: 'Review proposal, then have Codex implement only after approval.',
            requiresApproval: true,
            degraded: false,
            tags: ['patch-proposal'],
          });

          tryAppendEvent({
            type: 'coding_plan_generated',
            title: `Patch proposal: ${proposal.title}`,
            summary: 'Proposal-only patch plan generated. No files were edited.',
            severity: 'success',
            toolName: 'generate_patch_proposal',
            packetId: proposalPacketId,
            generatedFiles: proposal.generatedFiles,
            sources: (proposal.evidenceSources || []).slice(0, 5),
            evidenceLevel: task?.evidenceLevel || packet?.evidenceLevel || 'E0',
            metadata: { proposalId: proposal.id, applyStatus: proposal.applyStatus },
          });

          respondJson(res, 200, {
            ok: true,
            proposal,
            generatedFiles: proposal.generatedFiles,
            requiresApproval: true,
            applyStatus: 'proposal_only',
            packetId: proposalPacketId,
          });
        } catch (err) {
          respondJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      const taskStatusMatch = url.pathname.match(/^\/tasks\/([^/]+)\/status$/);
      if (req.method === 'POST' && taskStatusMatch) {
        const body = await readBody(req);
        try {
          const task = updateTaskStatus(taskStatusMatch[1], body?.status, TASKS_DIR);
          tryAppendEvent({
            type: 'runtime_status',
            title: `Task status: ${task.status}`,
            summary: `${task.title} is now ${task.status}.`,
            severity: 'info',
            packetId: task.sourcePacketId,
            metadata: { taskId: task.id, status: task.status },
          });
          respondJson(res, 200, { ok: true, task });
        } catch (err) {
          respondJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        respondJson(res, 200, await buildHealth());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/snapshot') {
        respondJson(res, 200, await buildSnapshot());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/bench-evidence') {
        const classify = runAllowlistedCommand('bench-evidence-classify');
        const evidence = loadBenchEvidenceSummary();
        respondJson(res, 200, {
          ...evidence,
          warning: classify.ok ? null : 'bench-evidence-classify-failed',
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/bench-timeline') {
        respondJson(res, 200, { ok: true, timeline: loadBenchTimeline() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/control-next') {
        const result = runAllowlistedCommand('control-next');
        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          command: 'control-next',
          data: loadControlNext(),
          stderr: result.stderr.trim(),
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/chat') {
        const body = await readBody(req);
        const message = sanitizeUserText(body?.message || '');
        const mode = sanitizeUserText(body?.mode || 'ask') || 'ask';
        const history = Array.isArray(body?.history) ? body.history : [];
        const allowTools = body?.allowTools !== false;
        const maxToolCalls = Number.isFinite(body?.maxToolCalls) ? Number(body.maxToolCalls) : 4;

        if (!message) {
          respondJson(res, 400, { ok: false, error: 'message is required.' });
          return;
        }

        const snapshot = await buildSnapshot();
        const health = await buildHealth();

        const response = await runMarcusAgentLoop({
          userMessage: message,
          mode,
          snapshot,
          maxToolCalls,
          allowTools,
          toolRegistry: marcusToolRegistry,
          callOllamaChat: async ({ messages, tools }) => {
            const mergedMessages = [
              ...history
                .filter((entry) => entry && typeof entry.role === 'string' && typeof entry.content === 'string')
                .slice(-8),
              ...messages,
            ];
            const ollama = await callOllamaChat({ messages: mergedMessages, tools });
            if (!ollama.ok) {
              throw new Error(ollama.error || 'ollama-call-failed');
            }
            return ollama;
          },
          ollamaOnline: Boolean(health.agent.ollama_online),
        });

        const git = gitSummary();
        const dirtyRepoWarning = !git.clean && mode === 'coding-plan';
        const chatWarnings = dirtyRepoWarning
          ? [...response.warnings, 'Repository has local changes. Review coding plan cautiously before implementation.']
          : response.warnings;

        // Emit session events for user message, tool calls, warnings, degraded state
        tryAppendEvent({
          type: 'user_message',
          title: message.slice(0, 100),
          summary: message.slice(0, 500),
          severity: 'info',
          metadata: { mode },
        });

        for (const tool of response.toolsUsed || []) {
          tryAppendEvent({
            type: 'tool_call',
            title: `Tool: ${tool.name}`,
            summary: tool.summary || '',
            severity: tool.ok ? 'info' : 'warn',
            toolName: tool.name,
          });
        }

        if (response.degraded) {
          tryAppendEvent({
            type: 'degraded_mode',
            title: 'Marcus running in degraded/fallback mode',
            summary: 'Ollama unavailable; local tool fallback used.',
            severity: 'warn',
            degraded: true,
            metadata: { mode },
          });
        }

        for (const warning of (response.warnings || []).slice(0, 5)) {
          tryAppendEvent({
            type: 'warning',
            title: String(warning).slice(0, 100),
            summary: String(warning).slice(0, 500),
            severity: 'warn',
          });
        }

        const packetType = response.degraded ? 'fallback_report' : 'chat_answer';
        const packetId = trySavePacket({
          type: packetType,
          title: message.slice(0, 100),
          summary: String(response.reply || '').slice(0, 280),
          prompt: message,
          reply: response.reply,
          mode,
          toolsUsed: response.toolsUsed,
          sources: response.sources,
          evidenceLevel: response.evidenceLevel,
          sourceConfidence: response.sourceConfidence,
          generatedFiles: response.generatedFiles,
          warnings: chatWarnings,
          recommendedAction: response.recommendedNextAction,
          requiresApproval: response.requiresApproval,
          degraded: response.degraded,
          tags: [mode],
        });

        // Emit marcus_reply and packet_saved events
        tryAppendEvent({
          type: 'marcus_reply',
          title: String(response.reply || 'Reply').slice(0, 100),
          summary: String(response.reply || '').slice(0, 500),
          severity: response.degraded ? 'warn' : 'success',
          packetId,
          sources: (response.sources || []).slice(0, 5),
          evidenceLevel: response.evidenceLevel,
          generatedFiles: (response.generatedFiles || []).slice(0, 5),
          degraded: response.degraded,
          metadata: { mode, sourceConfidence: response.sourceConfidence },
        });

        if (packetId) {
          tryAppendEvent({
            type: 'packet_saved',
            title: `Packet saved: ${packetType}`,
            summary: message.slice(0, 100),
            severity: 'success',
            packetId,
            metadata: { packetType },
          });
        }

        respondJson(res, 200, {
          ok: true,
          mode,
          reply: response.reply,
          toolsUsed: response.toolsUsed,
          sources: response.sources,
          evidenceLevel: response.evidenceLevel,
          sourceConfidence: response.sourceConfidence,
          warnings: chatWarnings,
          generatedFiles: response.generatedFiles,
          recommendedNextAction: response.recommendedNextAction,
          requiresApproval: response.requiresApproval,
          degraded: response.degraded,
          agent_name: 'Marcus',
          source_hints: ['snapshot', 'bench-evidence', 'control-next', ...(response.sources || []).map((source) => source.id)],
          packetId,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/coding-plan') {
        const body = await readBody(req);
        const rawUserRequest = sanitizeUserText(body?.raw_user_request || body?.message || '');
        const targetSurface = sanitizeUserText(body?.target_surface || 'unspecified');
        const urgency = sanitizeUserText(body?.urgency || 'normal');
        const constraints = sanitizeUserText(body?.constraints || 'none');

        if (!rawUserRequest) {
          respondJson(res, 400, { ok: false, error: 'raw_user_request is required.' });
          return;
        }

        const result = await marcusToolRegistry.executeTool('generate_codex_packet', {
          raw_user_request: rawUserRequest,
          target_surface: targetSurface,
          urgency,
          constraints,
          mode: 'coding-plan',
        });

        const git = gitSummary();
        const codingPlanWarnings = !git.clean ? ['Repository has local changes. Review packet with extra caution.'] : [];
        const codingPlanReply = result.ok
          ? 'Marcus generated a safe coding-plan packet. Review and approve before applying changes.'
          : 'Marcus failed to generate coding-plan packet.';

        const cpPacketId = trySavePacket({
          type: 'coding_plan',
          title: rawUserRequest.slice(0, 100),
          summary: codingPlanReply,
          prompt: rawUserRequest,
          reply: codingPlanReply,
          mode: 'coding-plan',
          toolsUsed: [{ name: 'generate_codex_packet', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          generatedFiles: result.generatedFiles,
          warnings: codingPlanWarnings,
          recommendedAction: 'Review packet content, then run focused tests before any implementation.',
          requiresApproval: true,
          degraded: false,
          tags: ['coding-plan', targetSurface],
        });

        tryAppendEvent({
          type: 'coding_plan_generated',
          title: `Coding plan: ${rawUserRequest.slice(0, 80)}`,
          summary: codingPlanReply,
          severity: result.ok ? 'success' : 'warn',
          toolName: 'generate_codex_packet',
          packetId: cpPacketId,
          generatedFiles: (result.generatedFiles || []).slice(0, 5),
          sources: (result.sources || []).slice(0, 5),
          evidenceLevel: result.evidenceLevel,
          metadata: { targetSurface, urgency },
        });

        if (cpPacketId) {
          tryAppendEvent({
            type: 'packet_saved',
            title: 'Coding plan packet saved',
            summary: rawUserRequest.slice(0, 100),
            severity: 'success',
            packetId: cpPacketId,
            metadata: { packetType: 'coding_plan' },
          });
        }

        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'coding-plan',
          reply: codingPlanReply,
          toolsUsed: [{ name: 'generate_codex_packet', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          warnings: codingPlanWarnings,
          generatedFiles: result.generatedFiles,
          recommendedNextAction: 'Review packet content, then run focused tests before any implementation.',
          requiresApproval: true,
          degraded: false,
          details: result,
          packetId: cpPacketId,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/problem-intake') {
        const body = await readBody(req);
        const raw_feedback = sanitizeUserText(body?.raw_feedback || body?.message || '');
        if (!raw_feedback) {
          respondJson(res, 400, { ok: false, error: 'raw_feedback is required.' });
          return;
        }

        const result = await marcusToolRegistry.executeTool('problem_intake', { raw_feedback });
        const packet = readJsonMaybe(PROBLEM_PACKET_JSON);
        const piReply = result.ok ? 'Problem intake packet generated from raw feedback.' : 'Problem intake packet generation failed.';

        const piPacketId = trySavePacket({
          type: 'problem_packet',
          title: raw_feedback.slice(0, 100),
          summary: piReply,
          prompt: raw_feedback,
          reply: piReply,
          mode: 'problem-packet',
          toolsUsed: [{ name: 'problem_intake', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          generatedFiles: result.generatedFiles,
          warnings: result.warnings,
          recommendedAction: 'Inspect the generated problem packet before implementation.',
          requiresApproval: false,
          degraded: !result.ok,
          tags: ['problem-intake'],
        });

        if (piPacketId) {
          tryAppendEvent({
            type: 'packet_saved',
            title: 'Problem packet saved',
            summary: raw_feedback.slice(0, 100),
            severity: 'success',
            packetId: piPacketId,
            metadata: { packetType: 'problem_packet' },
          });
        }

        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'problem-packet',
          reply: piReply,
          toolsUsed: [{ name: 'problem_intake', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          warnings: result.warnings,
          generatedFiles: result.generatedFiles,
          recommendedNextAction: 'Inspect the generated problem packet before implementation.',
          requiresApproval: false,
          degraded: false,
          packet_id: packet?.id ?? null,
          interpreted_problem: packet?.interpreted_product_problem ?? null,
          product_surface: packet?.product_surface ?? null,
          severity: packet?.severity ?? null,
          stderr: result.error || null,
          packetId: piPacketId,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/memory-search') {
        const body = await readBody(req);
        const query = sanitizeUserText(body?.query || 'RedByte product truth');
        const result = await marcusToolRegistry.executeTool('memory_search', { query });
        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'ask',
          reply: result.ok ? 'Memory search completed.' : 'Memory search failed.',
          toolsUsed: [{ name: 'memory_search', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          warnings: result.warnings,
          generatedFiles: result.generatedFiles,
          recommendedNextAction: 'Treat memory output as supporting context, not canonical truth.',
          requiresApproval: false,
          degraded: !result.ok,
          query,
          output: result.data?.output || '',
          error: result.error || null,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/trace-claim') {
        const body = await readBody(req);
        const claim = sanitizeUserText(body?.claim || 'Draft export is not trusted export');
        const result = await marcusToolRegistry.executeTool('trace_claim', { claim });
        const tcReply = result.ok ? 'Claim trace completed.' : 'Claim trace failed.';

        const tcPacketId = trySavePacket({
          type: 'trace_report',
          title: claim.slice(0, 100),
          summary: tcReply,
          prompt: claim,
          reply: String(result.data?.output || tcReply).slice(0, 8000),
          mode: 'trace-claim',
          toolsUsed: [{ name: 'trace_claim', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          generatedFiles: result.generatedFiles,
          warnings: result.warnings,
          recommendedAction: 'Review canonical repo docs before treating generated trace output as truth.',
          requiresApproval: false,
          degraded: !result.ok,
          tags: ['trace-claim'],
        });

        tryAppendEvent({
          type: 'source_grounding',
          title: `Claim trace: ${claim.slice(0, 80)}`,
          summary: tcReply,
          severity: result.ok ? 'info' : 'warn',
          toolName: 'trace_claim',
          packetId: tcPacketId,
          sources: (result.sources || []).slice(0, 5),
          evidenceLevel: result.evidenceLevel,
          degraded: !result.ok,
        });

        if (tcPacketId) {
          tryAppendEvent({
            type: 'packet_saved',
            title: 'Trace report packet saved',
            summary: claim.slice(0, 100),
            severity: 'success',
            packetId: tcPacketId,
            metadata: { packetType: 'trace_report' },
          });
        }

        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'trace-claim',
          reply: tcReply,
          toolsUsed: [{ name: 'trace_claim', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          warnings: result.warnings,
          generatedFiles: result.generatedFiles,
          recommendedNextAction: 'Review canonical repo docs before treating generated trace output as truth.',
          requiresApproval: false,
          degraded: !result.ok,
          claim,
          output: result.data?.output || '',
          error: result.error || null,
          packetId: tcPacketId,
        });
        return;
      }

      respondJson(res, 404, {
        ok: false,
        error: 'Not found',
        endpoints: [
          'GET /health',
          'GET /',
          'GET /marcus',
          'GET /snapshot',
          'GET /packets',
          'GET /packets/:id',
          'GET /tasks',
          'GET /tasks/:id',
          'POST /tasks/from-packet',
          'POST /tasks/:id/status',
          'GET /code/search?q=',
          'GET /code/file?path=',
          'POST /patch-proposals',
          'GET /patch-proposals',
          'GET /patch-proposals/:id',
          'GET /session/events',
          'POST /session/clear',
          'POST /chat',
          'POST /coding-plan',
          'POST /problem-intake',
          'POST /memory-search',
          'POST /trace-claim',
          'GET /bench-evidence',
          'GET /bench-timeline',
          'GET /control-next',
        ],
      });
    } catch (error) {
      respondJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function runDoctor() {
  const health = await buildHealth();
  const bench = loadBenchEvidenceSummary();
  const controlProbe = runAllowlistedCommand('control-next');
  const report = {
    doctor: 'rb-hq',
    generated_at: new Date().toISOString(),
    health,
    bench_evidence: bench,
    control_next_ok: controlProbe.ok,
    control_next_stderr: controlProbe.stderr.trim() || null,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(controlProbe.ok ? 0 : 1);
}

async function main() {
  const command = process.argv[2] || 'serve';

  if (command === 'doctor') {
    await runDoctor();
    return;
  }

  if (command !== 'serve') {
    process.stderr.write('Usage: node scripts/rb-hq-server.mjs [serve|doctor]\n');
    process.exit(1);
  }

  const server = createHqServer();
  server.listen(DEFAULT_PORT, HOST, () => {
    process.stdout.write(`[rb-hq] Marcus companion listening on http://${HOST}:${DEFAULT_PORT}/\n`);
    process.stdout.write(`[rb-hq] Repo root: ${REPO_ROOT}\n`);
    process.stdout.write(`[rb-hq] Obsidian writes enabled: ${REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES}\n`);
  });

  const shutdown = () => {
    server.close(() => {
      process.stdout.write('[rb-hq] server stopped\n');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === entryUrl) {
  void main();
}
