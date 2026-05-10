#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildRepoSummaryPacket, DEFAULT_MARCUS_BASE_URL } from './rb-marcus-sync.mjs';
import { collectRepoState, ensurePathInsideSessionDir, resolveRepoRoot } from './rb-session-close.mjs';

const START_PACKET_SCHEMA = 'redbyte-session-start-packet-v1';
const DEFAULT_TIMEOUT_MS = 2500;
const START_PACKET_JSON = 'latest-start-packet.json';
const START_PACKET_MD = 'latest-start-packet.md';
const MAX_ITEM_LENGTH = 320;

const DO_NOT_DO = [
  'Do not treat E2 board-program evidence as E3 observed behavior.',
  'Do not push unless explicitly instructed for this session.',
  'Do not touch product UI or IDE surfaces for process-only slices.',
  'Do not touch unrelated .agents/ or .codex/ local files.',
  'Do not add arbitrary shell execution to Marcus.',
  'Do not clone the full repo onto Marcus.',
];

const DOC_INPUTS = [
  'AI_STATE.md',
  'docs/ACTIVE_WORK.md',
  'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  'docs/product/RED_BYTE_OPERATING_LOOP.md',
  'docs/product/RED_BYTE_MARCUS_SYNC.md',
  'docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md',
  'docs/product/RED_BYTE_WORK_QUEUE.md',
];

function safeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength = MAX_ITEM_LENGTH) {
  const text = safeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function unique(items, limit = 10) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const normalized = truncate(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

function ensureSessionDir(rootDir) {
  const dir = path.join(rootDir, '.redbyte', 'session');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function fetchWithTimeout(fetchImpl, url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available. Use Node 20+ or provide fetchImpl.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetchImpl(url, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function loadEndpoint({ baseUrl, pathName, fetchImpl, timeoutMs }) {
  const url = `${baseUrl}${pathName}`;
  try {
    const response = await fetchWithTimeout(fetchImpl, url, timeoutMs);
    const body = parseJson(await response.text());
    if (!response.ok || !body) {
      return { available: false, body: null };
    }
    return { available: true, body };
  } catch {
    return { available: false, body: null };
  }
}

function extractNextWorkFromMarcus(nextWorkBody) {
  if (!nextWorkBody) return [];
  const candidates = [];

  if (Array.isArray(nextWorkBody.next_work)) {
    for (const item of nextWorkBody.next_work) {
      if (typeof item === 'string') {
        candidates.push(item);
        continue;
      }
      if (item && typeof item === 'object') {
        if (item.title) candidates.push(item.title);
        if (item.detail) candidates.push(item.detail);
        if (item.reason) candidates.push(item.reason);
      }
    }
  }

  if (nextWorkBody.summary) candidates.push(nextWorkBody.summary);
  if (nextWorkBody.source) candidates.push(`Marcus source: ${nextWorkBody.source}`);

  return unique(candidates, 8);
}

function extractEvidenceTruth(localPacket, evidenceBody) {
  const items = [...(localPacket?.evidence_notes || [])];
  if (evidenceBody && typeof evidenceBody === 'object') {
    if (evidenceBody.summary) items.push(evidenceBody.summary);
    if (Array.isArray(evidenceBody.notes)) items.push(...evidenceBody.notes);
    if (Array.isArray(evidenceBody.warnings)) items.push(...evidenceBody.warnings);
  }
  return unique(items, 10);
}

function extractProductTruth(localPacket, productBody) {
  const items = [...(localPacket?.current_product_truth || [])];
  if (productBody && typeof productBody === 'object') {
    if (productBody.summary) items.push(productBody.summary);
    if (Array.isArray(productBody.current_product_truth)) items.push(...productBody.current_product_truth);
    if (Array.isArray(productBody.truth)) items.push(...productBody.truth);
  }
  return unique(items, 10);
}

function extractBlockedWork(localPacket, productBody) {
  const items = [...(localPacket?.active_blockers || [])];
  if (productBody && typeof productBody === 'object') {
    if (Array.isArray(productBody.blocked_work)) items.push(...productBody.blocked_work);
    if (Array.isArray(productBody.blockers)) items.push(...productBody.blockers);
  }
  return unique(items, 10);
}

function firstCommands() {
  return [
    'pnpm rb:session:start',
    'pnpm rb:session:status',
    'pnpm rb:control:next',
    'pnpm rb:work:status',
    'git status --short',
  ];
}

function buildAgentPrompt(packet) {
  const firstNext = packet.next_recommended_work[0] || 'Review latest control recommendation and choose one bounded slice.';
  const firstBlocker = packet.blocked_work[0] || 'No blocker listed.';
  return truncate(
    `You are the next RedByte implementation agent on branch ${packet.repo.branch} at commit ${packet.repo.commit}. ` +
    `Start from the session-start packet, keep scope bounded, and do not drift from repo truth. ` +
    `Primary recommended work: ${firstNext}. ` +
    `Primary blocker: ${firstBlocker}. ` +
    `Follow do-not-do constraints and run the listed first commands before edits.`,
    900,
  );
}

export async function buildStartPacket({
  rootDir = process.cwd(),
  now = new Date(),
  baseUrl = DEFAULT_MARCUS_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  gitRunner,
} = {}) {
  const normalizedBaseUrl = safeText(baseUrl).replace(/\/+$/, '');
  const repo = collectRepoState(rootDir, gitRunner);

  const localPacket = buildRepoSummaryPacket({
    rootDir,
    now,
    gitInfo: { branch: repo.branch, commit: repo.commit },
  });

  const ping = await loadEndpoint({ baseUrl: normalizedBaseUrl, pathName: '/ping', fetchImpl, timeoutMs });
  const reachable = ping.available;

  const nextWorkResponse = reachable
    ? await loadEndpoint({ baseUrl: normalizedBaseUrl, pathName: '/next-work', fetchImpl, timeoutMs })
    : { available: false, body: null };
  const productStateResponse = reachable
    ? await loadEndpoint({ baseUrl: normalizedBaseUrl, pathName: '/product-state', fetchImpl, timeoutMs })
    : { available: false, body: null };
  const evidenceStatusResponse = reachable
    ? await loadEndpoint({ baseUrl: normalizedBaseUrl, pathName: '/evidence-status', fetchImpl, timeoutMs })
    : { available: false, body: null };

  const nextWork = unique([
    ...extractNextWorkFromMarcus(nextWorkResponse.body),
    ...(localPacket.next_recommended_work || []),
  ], 10);

  const packet = {
    schema: START_PACKET_SCHEMA,
    generated_at: now.toISOString(),
    repo: {
      branch: repo.branch,
      commit: repo.commit,
      dirty: repo.dirty,
      status_short: repo.status_short,
    },
    marcus: {
      base_url: normalizedBaseUrl,
      reachable,
      next_work_available: nextWorkResponse.available,
      product_state_available: productStateResponse.available,
      evidence_status_available: evidenceStatusResponse.available,
    },
    docs_inputs: DOC_INPUTS,
    product_truth: extractProductTruth(localPacket, productStateResponse.body),
    evidence_truth: extractEvidenceTruth(localPacket, evidenceStatusResponse.body),
    blocked_work: extractBlockedWork(localPacket, productStateResponse.body),
    next_recommended_work: nextWork,
    do_not_do: unique([...DO_NOT_DO, ...(localPacket.agent_warnings || [])], 10),
    first_commands: firstCommands(),
    agent_prompt: '',
  };

  packet.agent_prompt = buildAgentPrompt(packet);
  return packet;
}

function renderMarkdown(packet) {
  const lines = [
    '# RedByte Session Start Packet',
    '',
    `Generated: ${packet.generated_at}`,
    '',
    '## Repo',
    '',
    `- Branch: ${packet.repo.branch}`,
    `- Commit: ${packet.repo.commit}`,
    `- Dirty: ${packet.repo.dirty ? 'yes' : 'no'}`,
    ...packet.repo.status_short.map((item) => `- Status: ${item}`),
    '',
    '## Marcus Status',
    '',
    `- Reachable: ${packet.marcus.reachable ? 'yes' : 'no'}`,
    `- /next-work available: ${packet.marcus.next_work_available ? 'yes' : 'no'}`,
    `- /product-state available: ${packet.marcus.product_state_available ? 'yes' : 'no'}`,
    `- /evidence-status available: ${packet.marcus.evidence_status_available ? 'yes' : 'no'}`,
    '',
    '## Current Product Truth',
    '',
    ...(packet.product_truth.length ? packet.product_truth : ['none']).map((item) => `- ${item}`),
    '',
    '## Current Evidence Truth',
    '',
    ...(packet.evidence_truth.length ? packet.evidence_truth : ['none']).map((item) => `- ${item}`),
    '',
    '## Current Blockers',
    '',
    ...(packet.blocked_work.length ? packet.blocked_work : ['none']).map((item) => `- ${item}`),
    '',
    '## Next Recommended Work',
    '',
    ...(packet.next_recommended_work.length ? packet.next_recommended_work : ['none']).map((item) => `- ${item}`),
    '',
    '## Do Not Do',
    '',
    ...packet.do_not_do.map((item) => `- ${item}`),
    '',
    '## First Commands',
    '',
    ...packet.first_commands.map((item) => `- ${item}`),
    '',
    '## Agent Prompt',
    '',
    packet.agent_prompt,
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function writeStartPacketFiles(rootDir, packet) {
  const sessionDir = ensureSessionDir(rootDir);
  const jsonPath = path.join(sessionDir, START_PACKET_JSON);
  const markdownPath = path.join(sessionDir, START_PACKET_MD);

  ensurePathInsideSessionDir(rootDir, jsonPath);
  ensurePathInsideSessionDir(rootDir, markdownPath);

  fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, renderMarkdown(packet), 'utf8');

  return {
    jsonPath,
    markdownPath,
  };
}

function parseCommand(argv = process.argv.slice(2)) {
  const command = safeText(argv[0] || 'start').toLowerCase();
  if (command === 'start') return 'start';
  if (command === 'test') return 'test';
  throw new Error('Usage: node scripts/rb-session-start.mjs [start|test]');
}

export async function startCommand({ rootDir = process.cwd() } = {}) {
  const packet = await buildStartPacket({ rootDir, baseUrl: process.env.MARCUS_BASE_URL || DEFAULT_MARCUS_BASE_URL });
  const files = writeStartPacketFiles(rootDir, packet);

  const result = {
    schema: 'redbyte-session-start-result-v1',
    generated_at: packet.generated_at,
    report_json: path.relative(rootDir, files.jsonPath).replace(/\\/g, '/'),
    report_markdown: path.relative(rootDir, files.markdownPath).replace(/\\/g, '/'),
    marcus_reachable: packet.marcus.reachable,
    repo_dirty: packet.repo.dirty,
    next_recommended_work_count: packet.next_recommended_work.length,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return { packet, files, result };
}

export async function selfTest() {
  const rootDir = resolveRepoRoot(process.cwd());
  const packet = await buildStartPacket({
    rootDir,
    now: new Date('2026-01-01T00:00:00.000Z'),
    fetchImpl: async () => {
      throw new Error('offline-test');
    },
  });

  if (packet.schema !== START_PACKET_SCHEMA) {
    throw new Error('Self-test failed: schema mismatch.');
  }
  if (!Array.isArray(packet.next_recommended_work) || packet.next_recommended_work.length === 0) {
    throw new Error('Self-test failed: next recommended work missing.');
  }
  if (!Array.isArray(packet.do_not_do) || packet.do_not_do.length === 0) {
    throw new Error('Self-test failed: do-not-do list missing.');
  }

  process.stdout.write('[rb-session-start] [ok] self-test passed\n');
}

async function main(argv = process.argv.slice(2)) {
  const command = parseCommand(argv);
  const rootDir = resolveRepoRoot(process.cwd());

  if (command === 'test') {
    await selfTest();
    return;
  }

  await startCommand({ rootDir });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[rb-session-start] [error] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

export {
  START_PACKET_SCHEMA,
  DO_NOT_DO,
  parseCommand,
};
