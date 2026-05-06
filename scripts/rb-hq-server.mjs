#!/usr/bin/env node

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarcusToolRegistry } from './marcus/marcus-tool-registry.mjs';
import { runMarcusAgentLoop } from './marcus/marcus-agent-loop.mjs';

const DEFAULT_PORT = Number(process.env.REDBYTE_HQ_PORT || 4255);
const HOST = '127.0.0.1';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const REDBYTE_AGENT_MODEL = process.env.REDBYTE_AGENT_MODEL || 'qwen2.5-coder:1.5b';
const REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES = String(process.env.REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES || 'false').toLowerCase() === 'true';
const MAX_BODY_BYTES = 64 * 1024;
const OLLAMA_TIMEOUT_MS = Number(process.env.REDBYTE_HQ_OLLAMA_TIMEOUT_MS || 30000);

const REPO_ROOT = resolveRepoRoot();
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

        respondJson(res, 200, {
          ok: true,
          mode,
          reply: response.reply,
          toolsUsed: response.toolsUsed,
          sources: response.sources,
          evidenceLevel: response.evidenceLevel,
          sourceConfidence: response.sourceConfidence,
          warnings: dirtyRepoWarning
            ? [...response.warnings, 'Repository has local changes. Review coding plan cautiously before implementation.']
            : response.warnings,
          generatedFiles: response.generatedFiles,
          recommendedNextAction: response.recommendedNextAction,
          requiresApproval: response.requiresApproval,
          degraded: response.degraded,
          agent_name: 'Marcus',
          source_hints: ['snapshot', 'bench-evidence', 'control-next', ...(response.sources || []).map((source) => source.id)],
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

        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'coding-plan',
          reply: result.ok
            ? 'Marcus generated a safe coding-plan packet. Review and approve before applying changes.'
            : 'Marcus failed to generate coding-plan packet.',
          toolsUsed: [{ name: 'generate_codex_packet', ok: result.ok, summary: result.summary }],
          sources: result.sources,
          evidenceLevel: result.evidenceLevel,
          sourceConfidence: result.sourceConfidence,
          warnings: !git.clean ? ['Repository has local changes. Review packet with extra caution.'] : [],
          generatedFiles: result.generatedFiles,
          recommendedNextAction: 'Review packet content, then run focused tests before any implementation.',
          requiresApproval: true,
          degraded: false,
          details: result,
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
        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'problem-packet',
          reply: result.ok ? 'Problem intake packet generated from raw feedback.' : 'Problem intake packet generation failed.',
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
        respondJson(res, result.ok ? 200 : 500, {
          ok: result.ok,
          mode: 'trace-claim',
          reply: result.ok ? 'Claim trace completed.' : 'Claim trace failed.',
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
        });
        return;
      }

      respondJson(res, 404, {
        ok: false,
        error: 'Not found',
        endpoints: [
          'GET /health',
          'GET /snapshot',
          'POST /chat',
          'POST /coding-plan',
          'POST /problem-intake',
          'POST /memory-search',
          'POST /trace-claim',
          'GET /bench-evidence',
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
    process.stdout.write(`[rb-hq] Marcus HQ server listening on http://${HOST}:${DEFAULT_PORT}\n`);
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
