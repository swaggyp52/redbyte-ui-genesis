#!/usr/bin/env node

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export const DEFAULT_MARCUS_BASE_URL = 'http://192.168.1.103:4260';
export const PACKET_LIMIT_BYTES = 50_000;
export const SOURCE_FILES = [
  'AI_STATE.md',
  'docs/ACTIVE_WORK.md',
  'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  'docs/product/RED_BYTE_WORK_QUEUE.md',
  'docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md',
  'docs/release/vivado-basys3-certification-matrix.md',
  'docs/STUDENT_RELEASE_READINESS.md',
];

const DEFAULT_PRODUCT_TRUTH = [
  'RedByte is a proof-backed FPGA/digital-logic engineering workbench for supported Basys3 workflows.',
  'Workflow spine: Project -> Design -> Verify -> Map Pins / Hardware -> Export -> Vivado / board evidence.',
  'Trusted Export requires current Verify evidence, current pin mapping, and a current export bundle.',
  'Vivado build, board programming, and physical observation are external proof tiers.',
  'E2 board programming is not E3 observed behavior.',
];

const DEFAULT_AGENT_WARNINGS = [
  'Do not treat E2 as E3.',
  'Do not claim board behavior without physical observation evidence.',
  'Do not infer logic bugs from missing E3 evidence.',
  'Do not clone the full repo onto Marcus.',
  'Do not add arbitrary shell execution to Marcus.',
  'Do not call Marcus ByteSmith.',
];

function unique(items, limit = 8) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(truncate(normalized, 280));
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeText(value) {
  return sanitizeText(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .replace(/^[-*]\s+/, '')
    .replace(/^>\s*/, '')
    .trim();
}

function truncate(value, maxLength) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function sanitizeText(value) {
  return String(value ?? '')
    .replace(/MARCUS_TOKEN\s*=\s*["']?[^"'\s]+["']?/gi, 'MARCUS_TOKEN=[redacted]')
    .replace(/X-Marcus-Token\s*:\s*["']?[^"'\s]+["']?/gi, 'X-Marcus-Token: [redacted]')
    .replace(/marcus\.token/gi, '[redacted-token-file]')
    .replace(/\braspberry\b/gi, '[redacted-password]');
}

function readTextIfExists(rootDir, relPath) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) return '';
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) return '';
  const text = fs.readFileSync(fullPath, 'utf8');
  return sanitizeText(text.slice(0, 400_000));
}

function readSources(rootDir) {
  return Object.fromEntries(SOURCE_FILES.map((relPath) => [relPath, readTextIfExists(rootDir, relPath)]));
}

function stripMarkdown(line) {
  return line
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(new RegExp(`&rarr;|\\u2192|\\u00e2\\u2020\\u2019`, 'g'), '->')
    .replace(new RegExp(`[\\u2013\\u2014]|\\u00e2\\u20ac\\u201d`, 'g'), '-')
    .replace(new RegExp(`\\u00c2\\u00b7|\\u00b7`, 'g'), '-');
}

function lineMatches(line, needles) {
  const lower = line.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function extractHeadingSection(text, headingPattern, maxChars = 5000) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return '';
  const collected = [];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^#{1,3}\s+/.test(line) && collected.length > 0) break;
    collected.push(line);
    if (collected.join('\n').length >= maxChars) break;
  }
  return collected.join('\n');
}

function extractBullets(text, limit = 8) {
  const bullets = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripMarkdown(rawLine.trim());
    const bullet = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (!bullet) continue;
    const item = normalizeText(bullet[1]);
    if (item) bullets.push(item);
    if (bullets.length >= limit) break;
  }
  return bullets;
}

function extractTableRows(text, limit = 8) {
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripMarkdown(rawLine.trim());
    if (!line.startsWith('|') || /^[-|\s]+$/.test(line)) continue;
    const cells = line.split('|').map((cell) => normalizeText(cell)).filter(Boolean);
    if (cells.length < 2 || cells[0].toLowerCase() === '#') continue;
    rows.push(cells);
    if (rows.length >= limit) break;
  }
  return rows;
}

function extractRecentChanges(aiState) {
  const section = extractHeadingSection(aiState, /^##\s+Change Log/i, 4000);
  return unique(extractBullets(section, 10), 8);
}

function extractCurrentProductTruth(sources) {
  const currentTruth = sources['docs/product/RED_BYTE_CURRENT_TRUTH.md'] || '';
  const activeWork = sources['docs/ACTIVE_WORK.md'] || '';
  const productThesis = extractHeadingSection(currentTruth, /Current product thesis/i, 1500);
  const uxSpine = extractHeadingSection(currentTruth, /Current UX spine/i, 1200);
  const items = [
    ...DEFAULT_PRODUCT_TRUTH,
    ...extractBullets(productThesis, 4),
    ...extractBullets(uxSpine, 4),
  ];

  for (const line of [...productThesis.split(/\r?\n/), ...uxSpine.split(/\r?\n/), ...activeWork.split(/\r?\n/)].map(stripMarkdown)) {
    if (lineMatches(line, ['redbyte is', 'project -> design', 'trusted export', 'vivado remains'])) {
      items.push(line);
    }
  }

  return unique(items, 8);
}

function extractBlockers(sources) {
  const activeWork = sources['docs/ACTIVE_WORK.md'] || '';
  const currentTruth = sources['docs/product/RED_BYTE_CURRENT_TRUTH.md'] || '';
  const blockedSection = extractHeadingSection(activeWork, /^##\s+Blocked/i, 2500);
  const liveBlockers = extractHeadingSection(currentTruth, /Current live blockers/i, 3000);
  const items = [];

  for (const cells of extractTableRows(blockedSection, 8)) {
    if (cells[0].toLowerCase() === 'blocker') continue;
    items.push(`${cells[0]}: ${cells.slice(1).join(' - ')}`);
  }

  for (const line of [...extractBullets(liveBlockers, 10), ...extractBullets(blockedSection, 10)]) {
    if (lineMatches(line, ['blocked', 'blocker', 'manual', 'observation', 'e3', 'incomplete'])) {
      items.push(line);
    }
  }

  if (items.length === 0) {
    items.push('E3 proof closure is blocked on manual Basys3 board observation.');
  }
  return unique(items, 8);
}

function extractNextWork(sources) {
  const workQueue = sources['docs/product/RED_BYTE_WORK_QUEUE.md'] || '';
  const activeWork = sources['docs/ACTIVE_WORK.md'] || '';
  const items = [];

  for (const cells of extractTableRows(workQueue, 12)) {
    if (cells[0].toLowerCase() === '#') continue;
    const joined = cells.join(' ');
    if (joined.includes('~~')) continue;
    const slice = cells[1] || cells[0];
    const why = cells[2] ? ` - ${cells[2]}` : '';
    if (slice) items.push(`${slice}${why}`);
  }

  const benchSection = extractHeadingSection(activeWork, /Next bench \/ Vivado task/i, 1600);
  items.push(...extractBullets(benchSection, 4));
  if (items.length === 0) {
    items.push('Use repo-summary imports to keep Marcus aligned with RedByte product state.');
  }
  return unique(items, 8);
}

function extractEvidenceNotes(sources) {
  const matrix = sources['docs/release/vivado-basys3-certification-matrix.md'] || '';
  const readiness = sources['docs/STUDENT_RELEASE_READINESS.md'] || '';
  const activeWork = sources['docs/ACTIVE_WORK.md'] || '';
  const items = [];

  for (const line of [...matrix.split(/\r?\n/), ...readiness.split(/\r?\n/), ...activeWork.split(/\r?\n/)].map(stripMarkdown)) {
    if (lineMatches(line, ['e2', 'e3', 'controlled classification', 'hard rule', 'golden-basys3-switch-and', 'two-bit-counter', 'signal-tour', 'known bug'])) {
      const normalized = normalizeText(line);
      if (/^(pnpm\s+|\|\s*project \/ fixture\b|\|\s*starter \/ artifact\b)/i.test(normalized)) continue;
      if (normalized) items.push(normalized);
    }
  }

  items.unshift(
    'Current controlled evidence: golden-basys3-switch-and, two-bit-counter, and signal-tour are E2 only.',
    'No target should be treated as E3 unless physical observation is recorded.',
    'No known logic bug is recorded unless evidence explicitly says so.',
  );

  return unique(items, 10);
}

function deriveSummary(packetDraft) {
  const blocker = packetDraft.active_blockers[0] || 'E3 proof closure remains blocked on manual observation.';
  return truncate(
    `RedByte is a proof-backed FPGA/digital-logic engineering workbench. Current focus: keep product truth, evidence tiers, blockers, and next work synchronized with Marcus. Main blocker: ${blocker}`,
    520,
  );
}

function getGitValue(rootDir, args, fallback) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function resolveGitInfo(rootDir, override) {
  if (override) return override;
  return {
    branch: getGitValue(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
    commit: getGitValue(rootDir, ['rev-parse', '--short=12', 'HEAD'], 'unknown'),
  };
}

export function packetSizeBytes(packet) {
  return Buffer.byteLength(JSON.stringify(packet), 'utf8');
}

export function ensurePacketWithinLimit(packet, limit = PACKET_LIMIT_BYTES) {
  const size = packetSizeBytes(packet);
  if (size > limit) {
    throw new Error(`Marcus repo-summary packet is ${size} bytes; limit is ${limit} bytes.`);
  }
  return packet;
}

export function buildRepoSummaryPacket({
  rootDir = process.cwd(),
  now = new Date(),
  gitInfo,
} = {}) {
  const sources = readSources(rootDir);
  const resolvedGit = resolveGitInfo(rootDir, gitInfo);
  const packet = {
    source: 'redbyte-ui-genesis',
    branch: resolvedGit.branch || 'unknown',
    commit: resolvedGit.commit || 'unknown',
    generated_at: now.toISOString(),
    summary: '',
    current_product_truth: extractCurrentProductTruth(sources),
    recent_changes: extractRecentChanges(sources['AI_STATE.md'] || ''),
    active_blockers: extractBlockers(sources),
    next_recommended_work: extractNextWork(sources),
    evidence_notes: extractEvidenceNotes(sources),
    agent_warnings: unique(DEFAULT_AGENT_WARNINGS, 8),
  };
  packet.summary = deriveSummary(packet);
  return ensurePacketWithinLimit(packet);
}

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || DEFAULT_MARCUS_BASE_URL).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) {
    throw new Error(`Invalid MARCUS_BASE_URL: ${value}`);
  }
  return value;
}

export async function syncRepoSummary({
  baseUrl = DEFAULT_MARCUS_BASE_URL,
  token = process.env.MARCUS_TOKEN,
  packet,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!token || !String(token).trim()) {
    throw new Error('MARCUS_TOKEN is required for rb:marcus:sync.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available. Use Node 20+.');
  }
  const checkedPacket = ensurePacketWithinLimit(packet);
  const url = `${normalizeBaseUrl(baseUrl)}/repo-summary`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Marcus-Token': String(token),
      },
      body: JSON.stringify(checkedPacket),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Marcus sync failed: could not reach ${url}. ${reason}`);
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw_response: truncate(text, 1000) };
  }
  if (!response.ok) {
    throw new Error(`Marcus sync failed: ${response.status} ${truncate(JSON.stringify(body), 1000)}`);
  }
  return body;
}

function resolveRepoRoot() {
  return getGitValue(process.cwd(), ['rev-parse', '--show-toplevel'], process.cwd());
}

async function runSelfTest() {
  const packet = buildRepoSummaryPacket({ rootDir: resolveRepoRoot() });
  ensurePacketWithinLimit(packet);
  if (!packet.current_product_truth.length || !packet.next_recommended_work.length) {
    throw new Error('Self-test failed: generated packet is missing product truth or next work.');
  }
  process.stdout.write(`[rb-marcus-sync] [ok] self-test packet_size_bytes=${packetSizeBytes(packet)}\n`);
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'packet';
  const rootDir = resolveRepoRoot();
  const packet = buildRepoSummaryPacket({ rootDir });

  if (command === 'packet') {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    return;
  }

  if (command === 'sync') {
    const result = await syncRepoSummary({
      baseUrl: process.env.MARCUS_BASE_URL || DEFAULT_MARCUS_BASE_URL,
      token: process.env.MARCUS_TOKEN,
      packet,
    });
    process.stdout.write(`${JSON.stringify({ ...result, packet_size_bytes: packetSizeBytes(packet) }, null, 2)}\n`);
    return;
  }

  if (command === 'test') {
    await runSelfTest();
    return;
  }

  throw new Error('Usage: node scripts/rb-marcus-sync.mjs <packet|sync|test>');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[rb-marcus-sync] [error] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
