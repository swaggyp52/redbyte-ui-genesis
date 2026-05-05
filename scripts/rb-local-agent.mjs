#!/usr/bin/env node
/**
 * rb-local-agent.mjs
 *
 * RedByte Local Agent CLI — Ollama-backed repo intelligence harness.
 *
 * Commands:
 *   doctor    — Check Ollama availability, model, repo readiness
 *   context   — Build context bundle from control docs and git state
 *   next      — Generate next-task prompt via Ollama
 *   review    — Review current git diff against RedByte rules via Ollama
 *   doc-sync  — Identify doc/Obsidian gaps after a completed slice
 *   handoff   — Generate a handoff draft for the current session
 *
 * Safety contract:
 *   - Never edits product files (packages/, apps/, docs/, scripts/, src/)
 *   - Never stages or commits
 *   - Never pushes
 *   - Only writes to .redbyte/agent/runs/
 *   - Fails clearly if Ollama is not reachable
 *
 * Configuration:
 *   REDBYTE_AGENT_MODEL   — Ollama model name (default: qwen2.5-coder:7b)
 *   OLLAMA_BASE_URL       — Ollama base URL (default: http://localhost:11434)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.REDBYTE_AGENT_MODEL ?? 'qwen2.5-coder:7b';

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

// ─── Utilities ───────────────────────────────────────────────────────────────

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

// ─── Ollama client ───────────────────────────────────────────────────────────

async function ollamaChat(systemPrompt, userContent, { stream = false } = {}) {
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  const body = JSON.stringify({
    model: MODEL,
    stream,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    options: {
      temperature: 0.2,
      num_ctx: 8192,
    },
  });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    fatal(
      `Cannot reach Ollama at ${OLLAMA_BASE_URL}.\n` +
      `  Reason: ${reason}\n` +
      `  Fix: ensure Ollama is running (run 'ollama serve' or check system tray)\n` +
      `  Model: ${MODEL}\n` +
      `  Override URL: OLLAMA_BASE_URL=<url> pnpm rb:agent:doctor`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fatal(`Ollama API returned ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json?.message?.content ?? '';
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdDoctor() {
  info('Running RedByte Local Agent doctor...\n');

  // 1. Repo root
  info(`✓ Repo root: ${ROOT}`);

  // 2. Work driver packet
  const packet = path.join(WORK_DIR, 'NEXT_WORK_PACKET.md');
  if (fs.existsSync(packet)) {
    info(`✓ Work driver packet: ${packet}`);
  } else {
    info(`✗ Work driver packet not found — run: pnpm rb:work:next`);
  }

  // 3. Control docs
  for (const doc of CONTROL_DOCS) {
    const abs = path.join(ROOT, doc);
    if (fs.existsSync(abs)) {
      info(`✓ Control doc: ${doc}`);
    } else {
      info(`✗ Missing control doc: ${doc}`);
    }
  }

  // 4. Prompts
  const promptsExist = fs.existsSync(PROMPTS_DIR);
  info(promptsExist ? `✓ Prompts dir: ${PROMPTS_DIR}` : `✗ Prompts dir missing: ${PROMPTS_DIR}`);

  // 5. Git status
  const status = gitStatus();
  if (status === '') {
    info(`✓ Git working tree: clean`);
  } else {
    info(`⚠ Git working tree has uncommitted changes:\n${status}`);
  }

  // 6. Ollama smoke test
  info(`\nSmoking Ollama at ${OLLAMA_BASE_URL} with model ${MODEL}...`);
  try {
    const reply = await ollamaChat(
      'You are a smoke test. Respond with exactly: REDBYTE_AGENT_OK',
      'Smoke test ping.'
    );
    const trimmed = reply.trim();
    if (trimmed.includes('REDBYTE_AGENT_OK')) {
      info(`✓ Ollama responded: ${trimmed}`);
    } else {
      info(`⚠ Ollama responded (unexpected): ${trimmed.slice(0, 120)}`);
    }
  } catch {
    // fatal() already called inside ollamaChat
  }

  info('\n[rb-local-agent] doctor complete.');
}

async function cmdContext() {
  info('Building context bundle...');

  const parts = [];

  // Work driver packet
  const packet = readFile(path.join(WORK_DIR, 'NEXT_WORK_PACKET.md'));
  if (packet) {
    parts.push(`# Work Driver Packet\n\n${packet}`);
  } else {
    parts.push(`# Work Driver Packet\n\n(not found — run: pnpm rb:work:next)`);
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
  info(`✓ Context bundle written to: ${dest}`);
  info(`  Size: ${(bundle.length / 1024).toFixed(1)} KB`);
}

async function cmdNext() {
  info('Generating next-task prompt via Ollama...');

  // Ensure context exists
  const contextPath = path.join(RUNS_DIR, 'context-latest.md');
  if (!fs.existsSync(contextPath)) {
    info('Context bundle not found. Running context first...');
    await cmdContext();
  }

  const context = fs.readFileSync(contextPath, 'utf8');
  const systemPrompt = readPrompt('system') || 'You are the RedByte Local Agent.';
  const implPrompt = readPrompt('implementation') || '';

  const userContent =
    `${implPrompt}\n\n---\n\n` +
    `## Context bundle\n\n${context.slice(0, 10000)}\n\n` +
    `## Task\n\n` +
    `Given the work-driver packet and current truth above, produce the exact next implementation prompt ` +
    `for Claude or Copilot to execute the recommended slice. Follow the Implementation Prompt format. ` +
    `Be specific: name every file, every test, every gate command, every commit message line.`;

  info(`Calling Ollama (${MODEL})... this may take a moment.`);
  const reply = await ollamaChat(systemPrompt, userContent);

  const dest = writeRun('next-prompt.md', `# RedByte Next-Task Prompt\n\n_Generated ${new Date().toISOString()}_\n_Model: ${MODEL}_\n\n---\n\n${reply}`);
  info(`✓ Next-task prompt written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

async function cmdReview() {
  info('Reviewing current diff against RedByte rules...');

  const diff = gitDiff();
  if (!diff) {
    info('No changes in git diff — nothing to review.');
    const dest = writeRun('review-latest.md', `# RedByte Diff Review\n\n_Generated ${new Date().toISOString()}_\n\nNo diff to review — working tree matches HEAD.\n`);
    info(`✓ Review written to: ${dest}`);
    return;
  }

  const systemPrompt = readPrompt('reviewer') || readPrompt('system') || 'You are the RedByte code reviewer.';

  const userContent =
    `## Current git diff\n\n\`\`\`diff\n${diff.slice(0, 12000)}\n\`\`\`\n\n` +
    `## Task\n\n` +
    `Review this diff against the RedByte rules in your system prompt. ` +
    `Follow the review checklist exactly. Report CRITICAL and HIGH issues first.`;

  info(`Calling Ollama (${MODEL})...`);
  const reply = await ollamaChat(systemPrompt, userContent);

  const dest = writeRun('review-latest.md', `# RedByte Diff Review\n\n_Generated ${new Date().toISOString()}_\n_Model: ${MODEL}_\n\n---\n\n${reply}`);
  info(`✓ Review written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

async function cmdDocSync() {
  info('Checking doc/Obsidian sync requirements...');

  const diff = gitDiff();
  const aiState = readFile('AI_STATE.md') ?? '(not found)';
  const activeWork = readFile('docs/ACTIVE_WORK.md') ?? '(not found)';
  const packet = readFile(path.join(WORK_DIR, 'NEXT_WORK_PACKET.md')) ?? '(not found)';

  const systemPrompt = readPrompt('doc-sync') || readPrompt('system') || 'You are the RedByte doc-sync checker.';

  const userContent =
    `## Git diff (current changes)\n\n\`\`\`diff\n${(diff || '(no diff)').slice(0, 6000)}\n\`\`\`\n\n` +
    `## AI_STATE.md (last 2000 chars)\n\n${aiState.slice(-2000)}\n\n` +
    `## ACTIVE_WORK.md (last 2000 chars)\n\n${activeWork.slice(-2000)}\n\n` +
    `## Work driver packet\n\n${packet.slice(0, 2000)}\n\n` +
    `## Task\n\n` +
    `Using the doc-sync checklist, identify which documentation files need updates after this diff. ` +
    `State REQUIRED or OPTIONAL for each, and whether it appears to already be done.`;

  info(`Calling Ollama (${MODEL})...`);
  const reply = await ollamaChat(systemPrompt, userContent);

  const dest = writeRun('doc-sync-latest.md', `# RedByte Doc Sync Checklist\n\n_Generated ${new Date().toISOString()}_\n_Model: ${MODEL}_\n\n---\n\n${reply}`);
  info(`✓ Doc-sync checklist written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

async function cmdHandoff() {
  info('Generating session handoff draft...');

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
    `Be honest — do not claim pushed or live unless the evidence shows it.`;

  info(`Calling Ollama (${MODEL})...`);
  const reply = await ollamaChat(systemPrompt, userContent);

  const dest = writeRun('handoff-latest.md', `# RedByte Session Handoff\n\n_Generated ${new Date().toISOString()}_\n_Model: ${MODEL}_\n\n---\n\n${reply}`);
  info(`✓ Handoff draft written to: ${dest}`);
  process.stdout.write('\n' + reply + '\n\n');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const COMMANDS = {
  doctor: cmdDoctor,
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
    `  REDBYTE_AGENT_MODEL   Model to use (default: qwen2.5-coder:7b)\n` +
    `  OLLAMA_BASE_URL       Ollama base URL (default: http://localhost:11434)\n\n`
  );
  process.exit(cmd ? 1 : 0);
}

COMMANDS[cmd]().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  fatal(msg);
});
