#!/usr/bin/env node
/**
 * rb-local-agent.mjs
 *
 * RedByte Local Agent CLI - Ollama-backed repo intelligence harness.
 *
 * Commands:
 *   doctor    - Check Ollama availability, model, repo readiness
 *   ollama-doctor - Alias of doctor for explicit Ollama health checks
 *   context   - Build context bundle from control docs and git state
 *   next      - Generate next-task prompt via Ollama
 *   review    - Review current git diff against RedByte rules via Ollama
 *   doc-sync  - Identify doc/Obsidian gaps after a completed slice
 *   handoff   - Generate a handoff draft for the current session
 *
 * Safety contract:
 *   - Never edits product files (packages/, apps/, docs/, scripts/, src/)
 *   - Never stages or commits
 *   - Never pushes
 *   - Only writes to .redbyte/agent/runs/
 *   - Fails clearly if Ollama is not reachable
 *
 * Configuration:
 *   REDBYTE_AGENT_MODEL       - Ollama model name (default: auto-select installed small model)
 *   OLLAMA_BASE_URL           - Ollama base URL (default: http://localhost:11434)
 *   REDBYTE_AGENT_FORMAT      - Output format: 'markdown' (default) or 'json'
 *   REDBYTE_AGENT_TEMPERATURE - Sampling temperature (default: 0.2)
 *   REDBYTE_AGENT_CTX_LIMIT   - Max chars of context passed to Ollama (default: 10000)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// --- Config ------------------------------------------------------------------

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL_OVERRIDE = (process.env.REDBYTE_AGENT_MODEL ?? '').trim();
const FORMAT = (process.env.REDBYTE_AGENT_FORMAT ?? 'markdown').toLowerCase();
const TEMPERATURE = parseFloat(process.env.REDBYTE_AGENT_TEMPERATURE ?? '0.2');
const CTX_LIMIT = parseInt(process.env.REDBYTE_AGENT_CTX_LIMIT ?? '10000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REDBYTE_AGENT_TIMEOUT_MS ?? '90000', 10);
const DEFAULT_FALLBACK_MODEL = 'qwen2.5-coder:1.5b';
const PREFERRED_MODELS = [
  'qwen2.5-coder:1.5b',
  'qwen2.5-coder:1.5b-instruct',
  'qwen2.5-coder:1.5b-base',
  'qwen2.5-coder:0.5b',
  'gemma3:1b',
];

let ACTIVE_MODEL = MODEL_OVERRIDE || DEFAULT_FALLBACK_MODEL;
let ACTIVE_MODEL_SOURCE = MODEL_OVERRIDE ? 'env override' : 'fallback default';

const IS_JSON = FORMAT === 'json';

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fatal('rb-local-agent must run inside the redbyte-ui git repository.');
  }
}

const ROOT = resolveRepoRoot();
const RUNS_DIR = path.join(ROOT, '.redbyte', 'agent', 'runs');
const PROMPTS_DIR = path.join(ROOT, '.redbyte', 'agent', 'prompts');
const WORK_DIR = path.join(ROOT, '.redbyte', 'work');

const CONTROL_DOCS = [
  'AI_STATE.md',
  'docs/ACTIVE_WORK.md',
  'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md',
  'docs/product/RED_BYTE_WORK_QUEUE.md',
];

const OPTIONAL_DOCS = [
  'docs/product/RED_BYTE_OBSIDIAN_SYNC_RULES.md',
  'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md',
  'docs/STUDENT_RELEASE_READINESS.md',
];

// --- Utilities ---------------------------------------------------------------

function fatal(msg) {
  process.stderr.write(`\n[rb-local-agent] ERROR: ${msg}\n\n`);
  process.exit(1);
}

function info(msg) {
  process.stdout.write(`[rb-local-agent] ${msg}\n`);
}

function readFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8');
}

function writeRun(filename, content) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const dest = path.join(RUNS_DIR, filename);
  fs.writeFileSync(dest, content, 'utf8');
  return dest;
}

function gitStatus() {
  try {
    return execSync('git status --short', { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '(git status unavailable)';
  }
}

function gitDiff() {
  try {
    return execSync('git diff HEAD', { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '(git diff unavailable)';
  }
}

function gitLog() {
  try {
    return execSync('git log --oneline -5', { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '(git log unavailable)';
  }
}

function readPrompt(name) {
  const p = path.join(PROMPTS_DIR, `${name}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function isLikelySmallModel(name) {
  return /(0\.5b|1b|1\.5b|2b|3b|mini|small)/i.test(name);
}

function pickModelFromInstalled(modelNames) {
  for (const preferred of PREFERRED_MODELS) {
    if (modelNames.includes(preferred)) {
      return { model: preferred, source: `installed preferred (${preferred})` };
    }
  }

  const otherSmall = modelNames.find((name) => isLikelySmallModel(name));
  if (otherSmall) {
    return { model: otherSmall, source: `installed small model (${otherSmall})` };
  }

  return { model: DEFAULT_FALLBACK_MODEL, source: `fallback default (${DEFAULT_FALLBACK_MODEL})` };
}

function writeJsonDebug(commandName, reply) {
  const fileName = `${commandName}-invalid-json.txt`;
  return writeRun(fileName, reply);
}

function ensureJsonOrFatal(reply, commandName, requiredKeys = []) {
  if (!IS_JSON) return reply;

  let parsed;
  try {
    parsed = JSON.parse(reply);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const debugFile = writeJsonDebug(commandName, reply);
    fatal(
      `Invalid JSON response for '${commandName}' while REDBYTE_AGENT_FORMAT=json.\n` +
      `  Reason: ${reason}\n` +
      `  Model: ${ACTIVE_MODEL}\n` +
      `  Raw response saved to: ${debugFile}\n` +
      `  Try a model with better JSON adherence or set REDBYTE_AGENT_FORMAT=markdown.`
    );
  }

  const missing = requiredKeys.filter((key) => !(key in parsed));
  if (missing.length > 0) {
    const debugFile = writeJsonDebug(commandName, reply);
    fatal(
      `JSON response for '${commandName}' is missing required keys.\n` +
      `  Missing: ${missing.join(', ')}\n` +
      `  Model: ${ACTIVE_MODEL}\n` +
      `  Raw response saved to: ${debugFile}`
    );
  }

  return reply;
}

function parseModelNames(tagsJson) {
  const models = Array.isArray(tagsJson?.models) ? tagsJson.models : [];
  return models.map((m) => m?.name).filter(Boolean);
}

async function resolveActiveModelFromApi({ failIfUnreachable = false } = {}) {
  if (MODEL_OVERRIDE) {
    ACTIVE_MODEL = MODEL_OVERRIDE;
    ACTIVE_MODEL_SOURCE = 'env override';
    return { modelNames: [], apiChecked: false };
  }

  try {
    const tags = await getOllamaTags();
    const modelNames = parseModelNames(tags);
    const selected = pickModelFromInstalled(modelNames);
    ACTIVE_MODEL = selected.model;
    ACTIVE_MODEL_SOURCE = selected.source;
    return { modelNames, apiChecked: true };
  } catch (err) {
    if (failIfUnreachable) {
      const reason = err instanceof Error ? err.message : String(err);
      fatal(
        `Unable to resolve installed models from ${OLLAMA_BASE_URL}/api/tags.\n` +
        `  Reason: ${reason}\n` +
        `  PowerShell start command: Start-Process ollama`
      );
    }

    ACTIVE_MODEL = DEFAULT_FALLBACK_MODEL;
    ACTIVE_MODEL_SOURCE = `fallback default (${DEFAULT_FALLBACK_MODEL})`;
    return { modelNames: [], apiChecked: false };
  }
}

function getOllamaCliInfo() {
  let cliPath = '';
  try {
    cliPath = execSync('where ollama', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim().split(/\r?\n/)[0] ?? '';
  } catch {
    return { found: false, path: '', version: '', versionError: '' };
  }

  try {
    const version = execSync('ollama --version', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { found: true, path: cliPath, version, versionError: '' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { found: true, path: cliPath, version: '', versionError: reason };
  }
}

async function getOllamaTags() {
  const url = `${OLLAMA_BASE_URL}/api/tags`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }
  try {
    return await res.json();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON from ${url}: ${reason}`);
  }
}

// --- Ollama client -----------------------------------------------------------

async function ollamaChat(systemPrompt, userContent, { stream = false, forceJson = false } = {}) {
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  const payload = {
    model: ACTIVE_MODEL,
    stream,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    options: {
      temperature: TEMPERATURE,
      num_ctx: 8192,
    },
  };

  if (forceJson) {
    payload.format = 'json';
  }

  const body = JSON.stringify(payload);

  let res;
  let lastReason = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      break;
    } catch (err) {
      clearTimeout(timeout);
      const reason = err instanceof Error ? err.message : String(err);
      lastReason = reason;
      const isTimeoutAbort = reason.includes('aborted') || reason.includes('AbortError');

      if (attempt === 1 && isTimeoutAbort) {
        info(`[warn] Ollama request timed out after ${REQUEST_TIMEOUT_MS} ms, retrying once...`);
        continue;
      }

      throw new Error(
        `Cannot reach Ollama at ${OLLAMA_BASE_URL}.\n` +
        `  Reason: ${reason}\n` +
        `  Timeout: ${REQUEST_TIMEOUT_MS} ms\n` +
        `  Fix: ensure Ollama is running (run 'ollama serve' or check system tray)\n` +
        `  Model: ${ACTIVE_MODEL}\n` +
        `  Override URL: OLLAMA_BASE_URL=<url> pnpm rb:agent:ollama:doctor`
      );
    }
  }

  if (!res) {
    throw new Error(
      `Cannot reach Ollama at ${OLLAMA_BASE_URL}.\n` +
      `  Reason: ${lastReason || 'unknown'}\n` +
      `  Timeout: ${REQUEST_TIMEOUT_MS} ms\n` +
      `  Model: ${ACTIVE_MODEL}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama API returned ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json?.message?.content ?? '';
}

// --- Commands ----------------------------------------------------------------

async function cmdDoctor() {
  info('Running RedByte Local Agent doctor...\n');

  info('Environment summary:');
  info(`  OLLAMA_BASE_URL=${OLLAMA_BASE_URL}`);
  info(`  REDBYTE_AGENT_MODEL=${MODEL_OVERRIDE || '(auto)'}`);
  info(`  REDBYTE_AGENT_FORMAT=${FORMAT}`);
  info(`  REDBYTE_AGENT_TEMPERATURE=${TEMPERATURE}`);
  info(`  REDBYTE_AGENT_TIMEOUT_MS=${REQUEST_TIMEOUT_MS}`);
  info(`  REDBYTE_AGENT_CTX_LIMIT=${CTX_LIMIT}`);

  // 1. Repo root
  info(`[ok] Repo root: ${ROOT}`);

  // 2. Work driver packet
  const packet = path.join(WORK_DIR, 'NEXT_WORK_PACKET.md');
  if (fs.existsSync(packet)) {
    info(`[ok] Work driver packet: ${packet}`);
  } else {
    info(`[missing] Work driver packet not found - run: pnpm rb:work:next`);
  }

  // 3. Control docs
  for (const doc of CONTROL_DOCS) {
    const abs = path.join(ROOT, doc);
    if (fs.existsSync(abs)) {
      info(`[ok] Control doc: ${doc}`);
    } else {
      info(`[missing] Control doc: ${doc}`);
    }
  }

  // 4. Prompts
  const promptsExist = fs.existsSync(PROMPTS_DIR);
  info(promptsExist ? `[ok] Prompts dir: ${PROMPTS_DIR}` : `[missing] Prompts dir: ${PROMPTS_DIR}`);

  // 5. Git status
  const status = gitStatus();
  if (status === '') {
    info('[ok] Git working tree: clean');
  } else {
    info(`[warn] Git working tree has uncommitted changes:\n${status}`);
  }

  // 6. Ollama CLI check
  const cli = getOllamaCliInfo();
  if (cli.found) {
    info(`[ok] Ollama CLI found: ${cli.path}`);
    if (cli.version) {
      info(`[ok] Ollama CLI version: ${cli.version}`);
    } else {
      info(`[warn] Ollama CLI version command failed: ${cli.versionError}`);
      info('[warn] Continuing because API checks may still succeed.');
    }
  } else {
    info('[warn] Ollama CLI not found in PATH.');
    info('[warn] Continuing with direct API probe.');
  }

  await resolveActiveModelFromApi();

  // 7. Ollama API check
  let tags;
  try {
    tags = await getOllamaTags();
    info(`[ok] Ollama API reachable: ${OLLAMA_BASE_URL}/api/tags`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!cli.found) {
      fatal(
        `Ollama CLI missing and API unreachable at ${OLLAMA_BASE_URL}.\n` +
        `  API reason: ${reason}\n` +
        `  Install: https://ollama.com/download/windows\n` +
        `  Then start with: Start-Process ollama`
      );
    }
    fatal(
      `Ollama API is unreachable at ${OLLAMA_BASE_URL}.\n` +
      `  Reason: ${reason}\n` +
      `  PowerShell start command: Start-Process ollama\n` +
      `  Alternative foreground command: ollama serve\n` +
      `  Re-check with: Invoke-RestMethod -Uri \"${OLLAMA_BASE_URL}/api/tags\" -Method Get`
    );
  }

  const modelNames = parseModelNames(tags);
  const modelInstalled = modelNames.includes(ACTIVE_MODEL);
  info(`[ok] Installed models (${modelNames.length}): ${modelNames.join(', ') || 'none'}`);
  info(`[ok] Selected model: ${ACTIVE_MODEL} (${ACTIVE_MODEL_SOURCE})`);
  if (!modelInstalled) {
    const fallbackModel = pickModelFromInstalled(modelNames).model;
    fatal(
      `Selected model is not installed: ${ACTIVE_MODEL}\n` +
      `  Suggested pull: ollama pull ${ACTIVE_MODEL}\n` +
      `  Or set an installed model, for example:\n` +
      `  $env:REDBYTE_AGENT_MODEL=\"${fallbackModel}\"`
    );
  }

  // 8. Ollama smoke test
  info(`\nSmoke-testing Ollama markdown with model ${ACTIVE_MODEL}...`);
  try {
    const reply = await ollamaChat(
      'You are a smoke test. Respond with exactly: REDBYTE_AGENT_OK',
      'Smoke test ping.'
    );
    const trimmed = reply.trim();
    if (trimmed.includes('REDBYTE_AGENT_OK')) {
      info(`[ok] Ollama responded: ${trimmed}`);
    } else {
      fatal(
        `Ollama smoke test returned an unexpected response for ${ACTIVE_MODEL}.
  Expected token: REDBYTE_AGENT_OK
  Got: ${trimmed.slice(0, 160)}
  This indicates runtime/model instability; retry after restarting Ollama.`
      );
    }

    const jsonReply = await ollamaChat(
      'Return only valid JSON. No prose.',
      'Return exactly this object: {"ok":true,"name":"redbyte"}',
      { forceJson: true }
    );
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonReply);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      fatal(
        `Ollama JSON smoke test returned invalid JSON for ${ACTIVE_MODEL}.\n` +
        `  Reason: ${reason}\n` +
        `  Raw: ${jsonReply.slice(0, 200)}`
      );
    }

    if (parsedJson?.ok !== true || parsedJson?.name !== 'redbyte') {
      fatal(
        `Ollama JSON smoke test returned unexpected payload for ${ACTIVE_MODEL}.\n` +
        `  Expected: {"ok":true,"name":"redbyte"}\n` +
        `  Got: ${jsonReply.slice(0, 200)}`
      );
    }

    info('[ok] Ollama JSON smoke test passed.');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (reason.includes('memory layout cannot be allocated')) {
      fatal(
        `Model failed to start due to memory limits: ${ACTIVE_MODEL}\n` +
        `  Use a smaller model for local smoke tests, for example:\n` +
        `  ollama pull qwen2.5-coder:1.5b\n` +
        `  Fallback: ollama pull qwen2.5-coder:0.5b\n` +
        `  $env:REDBYTE_AGENT_MODEL=\"qwen2.5-coder:1.5b\"`
      );
    }
    throw err;
  }

  info('doctor complete.');
}

async function cmdContext() {
  info('Building context bundle...');

  const parts = [];

  // Work driver packet
  const packet = readFile(path.join(WORK_DIR, 'NEXT_WORK_PACKET.md'));
  if (packet) {
    parts.push(`# Work Driver Packet\n\n${packet}`);
  } else {
    parts.push(`# Work Driver Packet\n\n(not found - run: pnpm rb:work:next)`);
  }

  // Control docs
  for (const doc of CONTROL_DOCS) {
    const content = readFile(doc);
    if (content) {
      parts.push(`# ${doc}\n\n${content}`);
    } else {
      parts.push(`# ${doc}\n\n(not found)`);
    }
  }

  // Optional docs (truncated to keep context manageable)
  for (const doc of OPTIONAL_DOCS) {
    const content = readFile(doc);
    if (content) {
      const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n\n...(truncated)' : content;
      parts.push(`# ${doc}\n\n${truncated}`);
    }
  }

  // Git state
  parts.push(`# Git Status\n\n${gitStatus() || '(clean)'}`);
  parts.push(`# Recent Commits\n\n${gitLog()}`);

  const bundle = parts.join('\n\n---\n\n');
  const dest = writeRun('context-latest.md', bundle);
  info(`[ok] Context bundle written to: ${dest}`);
  info(`  Size: ${(bundle.length / 1024).toFixed(1)} KB`);
}

async function cmdNext() {
  info(`Generating next-task prompt via Ollama (format: ${FORMAT})...`);
  await resolveActiveModelFromApi();

  // Ensure context exists
  const contextPath = path.join(RUNS_DIR, 'context-latest.md');
  if (!fs.existsSync(contextPath)) {
    info('Context bundle not found. Running context first...');
    await cmdContext();
  }

  const context = fs.readFileSync(contextPath, 'utf8');
  const truncatedContext = context.slice(0, CTX_LIMIT);
  if (context.length > CTX_LIMIT) {
    info(`[warn] Context truncated from ${context.length} to ${CTX_LIMIT} chars.`);
  }
  const systemPrompt = readPrompt('system') || 'You are the RedByte Local Agent.';
  const implPrompt = readPrompt('implementation') || '';

  const jsonSchema = IS_JSON
    ? `\n\nRespond ONLY with valid JSON matching this schema (no markdown fences, no extra text):\n` +
      JSON.stringify({
        task_title: 'string',
        source_docs_read: ['string'],
        repo_state: 'clean|dirty',
        allowed_files: ['string'],
        forbidden_files: ['string'],
        validation_commands: ['string'],
        commit_message: 'string',
        prompt_markdown: 'string',
      }, null, 2)
    : '';

  const userContent =
    `${implPrompt}${jsonSchema}\n\n---\n\n` +
    `## Context bundle\n\n${truncatedContext}\n\n` +
    `## Task\n\n` +
    `Given the work-driver packet and current truth above, produce the exact next implementation prompt ` +
    `for Claude or Copilot to execute the recommended slice. Follow the Implementation Prompt format. ` +
    `Be specific: name every file, every test, every gate command, every commit message line.`;

  info(`Calling Ollama (${ACTIVE_MODEL})...`);
  const reply = ensureJsonOrFatal(
    await ollamaChat(systemPrompt, userContent, { forceJson: IS_JSON }),
    'next',
    IS_JSON
      ? ['task_title', 'source_docs_read', 'repo_state', 'allowed_files', 'forbidden_files', 'validation_commands', 'commit_message', 'prompt_markdown']
      : []
  );

  const outFile = IS_JSON ? 'next-prompt.json' : 'next-prompt.md';
  const content = IS_JSON
    ? reply
    : `# RedByte Next-Task Prompt\n\n_Generated ${new Date().toISOString()}_\n_Model: ${ACTIVE_MODEL}_\n_Format: ${FORMAT}_\n\n---\n\n${reply}`;
  const dest = writeRun(outFile, content);
  info(`[ok] Next-task prompt written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

async function cmdReview() {
  info(`Reviewing current diff (format: ${FORMAT})...`);
  await resolveActiveModelFromApi();

  const diff = gitDiff();
  if (!diff) {
    info('No changes in git diff - nothing to review.');
    const empty = IS_JSON
      ? JSON.stringify({ verdict: 'CLEAN', blocking_issues: [], non_blocking_issues: [], touched_files: [], validation_gaps: [], product_truth_risks: [], recommendation: 'No diff to review.' }, null, 2)
      : `# RedByte Diff Review\n\n_Generated ${new Date().toISOString()}_\n\nNo diff to review - working tree matches HEAD.\n`;
    const dest = writeRun(IS_JSON ? 'review-latest.json' : 'review-latest.md', empty);
    info(`[ok] Review written to: ${dest}`);
    return;
  }

  const systemPrompt = readPrompt('reviewer') || readPrompt('system') || 'You are the RedByte code reviewer.';

  const jsonSchema = IS_JSON
    ? `\n\nRespond ONLY with valid JSON matching this schema (no markdown fences, no extra text):\n` +
      JSON.stringify({
        verdict: 'CLEAN|HOLD|SPLIT',
        blocking_issues: [{ file: 'string', line: 'string', severity: 'CRITICAL|HIGH', rule: 'string', issue: 'string', fix: 'string' }],
        non_blocking_issues: [{ file: 'string', severity: 'MEDIUM|LOW', issue: 'string' }],
        touched_files: ['string'],
        validation_gaps: ['string'],
        product_truth_risks: ['string'],
        recommendation: 'string',
      }, null, 2)
    : '';

  const userContent =
    `## Current git diff\n\n\`\`\`diff\n${diff.slice(0, 12000)}\n\`\`\`${jsonSchema}\n\n` +
    `## Task\n\n` +
    `Review this diff against the RedByte rules in your system prompt. ` +
    (IS_JSON
      ? 'Output the JSON schema only. No other text.'
      : 'Follow the review checklist exactly. Report CRITICAL and HIGH issues first.');

  info(`Calling Ollama (${ACTIVE_MODEL})...`);
  const reply = ensureJsonOrFatal(
    await ollamaChat(systemPrompt, userContent, { forceJson: IS_JSON }),
    'review',
    IS_JSON
      ? ['verdict', 'blocking_issues', 'non_blocking_issues', 'touched_files', 'validation_gaps', 'product_truth_risks', 'recommendation']
      : []
  );

  const outFile = IS_JSON ? 'review-latest.json' : 'review-latest.md';
  const content = IS_JSON
    ? reply
    : `# RedByte Diff Review\n\n_Generated ${new Date().toISOString()}_\n_Model: ${ACTIVE_MODEL}_\n_Format: ${FORMAT}_\n\n---\n\n${reply}`;
  const dest = writeRun(outFile, content);
  info(`[ok] Review written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

async function cmdDocSync() {
  info(`Checking doc/Obsidian sync requirements (format: ${FORMAT})...`);
  await resolveActiveModelFromApi();

  const diff = gitDiff();
  const aiState = readFile('AI_STATE.md') ?? '(not found)';
  const activeWork = readFile('docs/ACTIVE_WORK.md') ?? '(not found)';
  const packet = readFile(path.join(WORK_DIR, 'NEXT_WORK_PACKET.md')) ?? '(not found)';

  const systemPrompt = readPrompt('doc-sync') || readPrompt('system') || 'You are the RedByte doc-sync checker.';

  const jsonSchema = IS_JSON
    ? `\n\nRespond ONLY with valid JSON matching this schema (no markdown fences, no extra text):\n` +
      JSON.stringify({
        needs_ai_state_update: 'boolean',
        needs_active_work_update: 'boolean',
        needs_product_doc_update: 'boolean',
        needs_obsidian_update: 'boolean',
        suggested_files: [{ file: 'string', action: 'string', priority: 'REQUIRED|OPTIONAL', done: 'boolean' }],
        handoff_note: 'string',
      }, null, 2)
    : '';

  const userContent =
    `## Git diff (current changes)\n\n\`\`\`diff\n${(diff || '(no diff)').slice(0, 6000)}\n\`\`\`\n\n` +
    `## AI_STATE.md (last 2000 chars)\n\n${aiState.slice(-2000)}\n\n` +
    `## ACTIVE_WORK.md (last 2000 chars)\n\n${activeWork.slice(-2000)}\n\n` +
    `## Work driver packet\n\n${packet.slice(0, 2000)}${jsonSchema}\n\n` +
    `## Task\n\n` +
    `Using the doc-sync checklist, identify which documentation files need updates after this diff. ` +
    (IS_JSON
      ? 'Output the JSON schema only. No other text.'
      : 'State REQUIRED or OPTIONAL for each, and whether it appears to already be done.');

  info(`Calling Ollama (${ACTIVE_MODEL})...`);
  const reply = ensureJsonOrFatal(
    await ollamaChat(systemPrompt, userContent, { forceJson: IS_JSON }),
    'doc-sync',
    IS_JSON
      ? ['needs_ai_state_update', 'needs_active_work_update', 'needs_product_doc_update', 'needs_obsidian_update', 'suggested_files', 'handoff_note']
      : []
  );

  const outFile = IS_JSON ? 'doc-sync-latest.json' : 'doc-sync-latest.md';
  const content = IS_JSON
    ? reply
    : `# RedByte Doc Sync Checklist\n\n_Generated ${new Date().toISOString()}_\n_Model: ${ACTIVE_MODEL}_\n_Format: ${FORMAT}_\n\n---\n\n${reply}`;
  const dest = writeRun(outFile, content);
  info(`[ok] Doc-sync checklist written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

async function cmdHandoff() {
  info('Generating session handoff draft...');
  await resolveActiveModelFromApi();

  const aiState = readFile('AI_STATE.md') ?? '(not found)';
  const activeWork = readFile('docs/ACTIVE_WORK.md') ?? '(not found)';
  const recentLog = gitLog();
  const status = gitStatus();
  const existingHandoff = readFile(path.join(WORK_DIR, 'HANDOFF_DRAFT.md')) ?? '(none)';

  const systemPrompt = readPrompt('system') || 'You are the RedByte Local Agent.';

  const userContent =
    `## Recent git log\n\n${recentLog}\n\n` +
    `## Git status\n\n${status || '(clean)'}\n\n` +
    `## AI_STATE.md (last 3000 chars)\n\n${aiState.slice(-3000)}\n\n` +
    `## ACTIVE_WORK.md (last 2000 chars)\n\n${activeWork.slice(-2000)}\n\n` +
    `## Existing handoff draft\n\n${existingHandoff.slice(0, 2000)}\n\n` +
    `## Task\n\n` +
    `Generate a concise session handoff draft. Include:\n` +
    `1. What was completed in this session (with commit hashes)\n` +
    `2. What is currently in-flight or blocked\n` +
    `3. The next recommended slice (from work driver)\n` +
    `4. Any doc/Obsidian updates still needed\n` +
    `5. Git state: branch, ahead/behind, pushed or not\n\n` +
    `Be honest - do not claim pushed or live unless the evidence shows it.`;

  info(`Calling Ollama (${ACTIVE_MODEL})...`);
  const reply = await ollamaChat(systemPrompt, userContent);

  const dest = writeRun('handoff-latest.md', `# RedByte Session Handoff\n\n_Generated ${new Date().toISOString()}_\n_Model: ${ACTIVE_MODEL}_\n\n---\n\n${reply}`);
  info(`[ok] Handoff draft written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

// --- Entry point -------------------------------------------------------------

const COMMANDS = {
  doctor: cmdDoctor,
  'ollama-doctor': cmdDoctor,
  context: cmdContext,
  next: cmdNext,
  review: cmdReview,
  'doc-sync': cmdDocSync,
  handoff: cmdHandoff,
};

const cmd = process.argv[2];

if (!cmd || !COMMANDS[cmd]) {
  process.stdout.write(
    `\nRedByte Local Agent\n\nUsage: pnpm rb:agent:<command>\n\nCommands:\n` +
    Object.keys(COMMANDS).map((c) => `  ${c}`).join('\n') +
    `\n\nEnvironment:\n` +
    `  REDBYTE_AGENT_MODEL       Model to use (default: auto-select installed small model)\n` +
    `  OLLAMA_BASE_URL           Ollama base URL (default: http://localhost:11434)\n` +
    `  REDBYTE_AGENT_FORMAT      Output format: markdown (default) or json\n` +
    `  REDBYTE_AGENT_TEMPERATURE Sampling temperature (default: 0.2)\n` +
    `  REDBYTE_AGENT_TIMEOUT_MS  Request timeout ms (default: 90000)\n` +
    `  REDBYTE_AGENT_CTX_LIMIT   Max chars of context sent to Ollama (default: 10000)\n\n`
  );
  process.exit(cmd ? 1 : 0);
}

COMMANDS[cmd]().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  fatal(msg);
});
