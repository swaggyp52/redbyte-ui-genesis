#!/usr/bin/env node
/**
 * rb-obsidian-memory.mjs
 *
 * RedByte Obsidian + Ollama Product Memory Bridge.
 *
 * The bridge indexes repo control docs and configured Obsidian notes into local,
 * inspectable chunks. It searches those chunks, asks Ollama for source-aware
 * synthesis, and writes reports only to generated, gitignored output paths.
 *
 * Safety contract:
 * - Never writes to the Obsidian vault in v0.
 * - Never edits product UI or product code.
 * - Never stages, commits, or pushes.
 * - Never treats Obsidian memory as higher authority than repo truth.
 */

import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL_OVERRIDE = (process.env.REDBYTE_AGENT_MODEL ?? '').trim();
const TEMPERATURE = Number.parseFloat(process.env.REDBYTE_AGENT_TEMPERATURE ?? '0.2');
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REDBYTE_AGENT_TIMEOUT_MS ?? '90000', 10);
const DEFAULT_CHAT_MODEL = 'qwen2.5-coder:1.5b';
const PREFERRED_CHAT_MODELS = [
  'qwen2.5-coder:1.5b',
  'qwen2.5-coder:1.5b-instruct',
  'qwen2.5-coder:1.5b-base',
  'qwen2.5-coder:0.5b',
  'gemma3:1b',
];
const PREFERRED_EMBEDDING_MODELS = ['all-minilm', 'embeddinggemma', 'nomic-embed-text'];

const REQUIRED_REPO_DOCS = [
  'AI_STATE.md',
  'docs/ACTIVE_WORK.md',
  'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md',
  'docs/product/RED_BYTE_WORK_QUEUE.md',
  'docs/product/RED_BYTE_OBSIDIAN_SYNC_RULES.md',
];

const SOURCE_PRIORITY = {
  current_truth: 0,
  target_contract: 1,
  surface_spec: 2,
  memory: 3,
  historical: 4,
  unknown: 5,
};

function fail(message, details = []) {
  process.stderr.write(`\n[rb-memory] ERROR: ${message}\n`);
  for (const detail of details) {
    if (detail) process.stderr.write(`${detail}\n`);
  }
  process.stderr.write('\n');
  process.exit(1);
}

function info(message) {
  process.stdout.write(`[rb-memory] ${message}\n`);
}

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail('rb-obsidian-memory must run inside the redbyte-ui git repository.');
  }
}

const ROOT = resolveRepoRoot();
const MEMORY_DIR = path.join(ROOT, '.redbyte', 'agent', 'memory');
const CONFIG_EXAMPLE = path.join(MEMORY_DIR, 'config.example.json');
const PRIVATE_CONFIG = path.join(MEMORY_DIR, 'config.json');
const RUNS_DIR = path.join(ROOT, '.redbyte', 'agent', 'runs');

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function relFromRoot(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Failed to parse JSON: ${relFromRoot(filePath)}`, [reason]);
  }
}

function mergeConfig(base, override) {
  return { ...base, ...override };
}

function loadConfig({ allowMissingPrivate = true } = {}) {
  if (!fs.existsSync(CONFIG_EXAMPLE)) {
    fail('Missing memory config example.', [relFromRoot(CONFIG_EXAMPLE)]);
  }

  const example = readJson(CONFIG_EXAMPLE);
  const hasPrivate = fs.existsSync(PRIVATE_CONFIG);
  if (!hasPrivate && !allowMissingPrivate) {
    fail('Missing private memory config.', [
      `Copy ${relFromRoot(CONFIG_EXAMPLE)} to ${relFromRoot(PRIVATE_CONFIG)} and set obsidianVaultPath if your vault is outside the repo.`,
    ]);
  }

  const config = hasPrivate ? mergeConfig(example, readJson(PRIVATE_CONFIG)) : example;
  return normalizeConfig(config, { hasPrivate });
}

function resolveConfigPath(value, baseDir = ROOT) {
  if (!value || value === '__FILL_IN__') return '';
  return path.resolve(baseDir, value);
}

function normalizeConfig(config, { hasPrivate = false } = {}) {
  const repoRoot = resolveConfigPath(config.repoRoot || '.', ROOT) || ROOT;
  const vaultBase = path.isAbsolute(config.obsidianVaultPath || '')
    ? config.obsidianVaultPath
    : path.resolve(ROOT, config.obsidianVaultPath || '');
  const indexOutputDir = path.isAbsolute(config.indexOutputDir || '')
    ? config.indexOutputDir
    : path.resolve(ROOT, config.indexOutputDir || '.redbyte/agent/memory/index');

  return {
    ...config,
    hasPrivateConfig: hasPrivate,
    repoRoot,
    obsidianVaultPathResolved: vaultBase,
    indexOutputDirResolved: indexOutputDir,
    maxFileBytes: Number(config.maxFileBytes || 262144),
    maxChunkChars: Number(config.maxChunkChars || 2400),
    maxChunksPerSource: Number(config.maxChunksPerSource || 80),
    allowVaultWrites: config.allowVaultWrites === true,
    traceabilityRequired: config.traceabilityRequired !== false,
    includeVaultGlobs: Array.isArray(config.includeVaultGlobs) ? config.includeVaultGlobs : [],
    excludeVaultGlobs: Array.isArray(config.excludeVaultGlobs) ? config.excludeVaultGlobs : [],
    includeRepoDocs: Array.isArray(config.includeRepoDocs) ? config.includeRepoDocs : [],
    excludeRepoGlobs: Array.isArray(config.excludeRepoGlobs) ? config.excludeRepoGlobs : [],
  };
}

function assertInside(child, parent, label) {
  const rel = path.relative(parent, child);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    fail(`${label} is outside the allowed directory.`, [
      `Path: ${child}`,
      `Allowed parent: ${parent}`,
    ]);
  }
}

function ensureGeneratedPath(targetPath) {
  const abs = path.resolve(targetPath);
  const allowed = [
    path.resolve(ROOT, '.redbyte', 'agent', 'runs'),
    path.resolve(ROOT, '.redbyte', 'agent', 'memory', 'index'),
  ];
  if (!allowed.some((dir) => {
    const rel = path.relative(dir, abs);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  })) {
    fail('Refusing to write outside generated memory/run output directories.', [abs]);
  }
}

function writeGenerated(filePath, content) {
  ensureGeneratedPath(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function appendJsonl(filePath, rows) {
  ensureGeneratedPath(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, body ? `${body}\n` : '', 'utf8');
}

function git(command, { allowFailure = false } = {}) {
  try {
    return execSync(`git ${command}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Git command failed: git ${command}`, [reason]);
  }
}

function isIgnoredByGit(relPath) {
  try {
    execSync(`git check-ignore -q -- "${relPath.replace(/"/g, '\\"')}"`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function globToRegExp(glob) {
  let out = '^';
  const normalized = toPosix(glob);
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '*') {
      if (next === '*') {
        const after = normalized[i + 2];
        if (after === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else if ('\\.^$+{}()|[]'.includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  out += '$';
  return new RegExp(out);
}

function compileGlobs(globs) {
  return globs.map((glob) => ({ glob, re: globToRegExp(glob) }));
}

function matchesAny(relPath, compiled) {
  const normalized = toPosix(relPath);
  return compiled.some(({ re }) => re.test(normalized));
}

function collectFiles(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;

  function walk(absDir) {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        files.push(abs);
      }
    }
  }

  walk(rootDir);
  return files;
}

function safeReadText(absPath, { maxFileBytes, sourcePath }) {
  const stat = fs.statSync(absPath);
  if (stat.size > maxFileBytes) {
    return { skipped: true, reason: `file too large (${stat.size} bytes)`, text: '' };
  }

  const buffer = fs.readFileSync(absPath);
  if (buffer.includes(0)) {
    return { skipped: true, reason: 'binary file', text: '' };
  }

  let text = buffer.toString('utf8');
  if (sourcePath === 'AI_STATE.md') {
    text = trimAiState(text);
  }

  return { skipped: false, reason: '', text };
}

function trimAiState(text) {
  const lines = text.split(/\r?\n/);
  const head = lines.slice(0, 260).join('\n');
  return [
    '<AI_STATE_RECENT_HEAD_ONLY>',
    'The full AI_STATE.md is intentionally not indexed as one huge memory source.',
    'Recent top section follows.',
    '</AI_STATE_RECENT_HEAD_ONLY>',
    '',
    head,
  ].join('\n');
}

function sourceRole(sourceType, sourcePath) {
  const p = toPosix(sourcePath);
  const lower = p.toLowerCase();
  if (/superseded|historical|deprecated/.test(lower)) return 'historical';
  if (sourceType === 'obsidian') return 'memory';
  if (
    p === 'AI_STATE.md' ||
    p === 'docs/ACTIVE_WORK.md' ||
    p === 'docs/product/RED_BYTE_CURRENT_TRUTH.md' ||
    p === 'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md' ||
    p === 'docs/product/RED_BYTE_WORK_QUEUE.md' ||
    p === 'docs/product/RED_BYTE_OBSIDIAN_SYNC_RULES.md' ||
    p === 'docs/product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md' ||
    p === 'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md' ||
    p === 'docs/product/V1_RELEASE_READINESS_CHECKLIST.md' ||
    p === 'docs/DOC_INDEX.md' ||
    p.startsWith('.redbyte/work/')
  ) {
    return 'current_truth';
  }
  if (
    p === 'docs/product/V1_RELEASE_SPEC.md' ||
    p === 'docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md' ||
    p === 'docs/contracts/RedByte_Product_Contract.md'
  ) {
    return 'target_contract';
  }
  if (
    p.startsWith('docs/ide/') ||
    p === 'docs/IDE_SYSTEM_MAP.md' ||
    p === 'docs/IDE_PRODUCT_DEBT_REGISTER.md' ||
    p === 'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md' ||
    p.startsWith('docs/manuals/') ||
    p.startsWith('docs/release/') ||
    p.startsWith('docs/rehearsal/')
  ) {
    return 'surface_spec';
  }
  if (lower.includes('stale') || lower.includes('archive') || lower.includes('00-canon')) {
    return 'historical';
  }
  return 'unknown';
}

function parseTitle(text, fallback) {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function chunkMarkdown({ text, sourcePath, sourceType, maxChunkChars, maxChunksPerSource }) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = { headingPath: [], lines: [] };
  const headingStack = [];

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (current.lines.join('\n').trim()) {
        sections.push(current);
      }
      const level = heading[1].length;
      headingStack.splice(level - 1);
      headingStack[level - 1] = heading[2].trim();
      current = {
        headingPath: headingStack.filter(Boolean),
        lines: [line],
      };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join('\n').trim()) sections.push(current);

  const title = parseTitle(text, path.basename(sourcePath));
  const chunks = [];
  for (const section of sections.length ? sections : [{ headingPath: [], lines }]) {
    const sectionText = section.lines.join('\n').trim();
    if (!sectionText) continue;
    const parts = splitLongText(sectionText, maxChunkChars);
    for (let i = 0; i < parts.length; i += 1) {
      chunks.push({
        source_type: sourceType,
        source_path: sourcePath,
        source_role: sourceRole(sourceType, sourcePath),
        title,
        heading_path: section.headingPath,
        text: parts[i],
      });
      if (chunks.length >= maxChunksPerSource) return chunks;
    }
  }
  return chunks;
}

function splitLongText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const parts = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';
  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) parts.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        parts.push(paragraph.slice(i, i + maxChars));
      }
      current = '';
    }
  }
  if (current) parts.push(current);
  return parts;
}

function buildSources(config) {
  const sources = [];
  const skipped = [];
  const repoExclude = compileGlobs(config.excludeRepoGlobs);

  for (const rel of config.includeRepoDocs) {
    const sourcePath = toPosix(rel);
    if (matchesAny(sourcePath, repoExclude)) {
      skipped.push({ source_type: 'repo', source_path: sourcePath, reason: 'excluded by repo glob' });
      continue;
    }
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) {
      skipped.push({ source_type: 'repo', source_path: sourcePath, reason: 'missing' });
      continue;
    }
    sources.push({ source_type: 'repo', absPath: abs, source_path: sourcePath });
  }

  const vaultPath = config.obsidianVaultPathResolved;
  if (vaultPath && fs.existsSync(vaultPath)) {
    const include = compileGlobs(config.includeVaultGlobs);
    const exclude = compileGlobs(config.excludeVaultGlobs);
    for (const abs of collectFiles(vaultPath)) {
      const rel = toPosix(path.relative(vaultPath, abs));
      if (!rel.endsWith('.md')) continue;
      if (matchesAny(rel, exclude)) continue;
      if (include.length > 0 && !matchesAny(rel, include)) continue;
      sources.push({ source_type: 'obsidian', absPath: abs, source_path: rel });
    }
  }

  sources.sort((a, b) => {
    const typeCompare = a.source_type.localeCompare(b.source_type);
    if (typeCompare !== 0) return typeCompare;
    return a.source_path.localeCompare(b.source_path);
  });

  return { sources, skipped };
}

function materializeChunks(config, sources) {
  const chunks = [];
  const sourceMap = [];
  const skipped = [];

  for (const source of sources) {
    const read = safeReadText(source.absPath, {
      maxFileBytes: config.maxFileBytes,
      sourcePath: source.source_path,
    });
    if (read.skipped) {
      skipped.push({ source_type: source.source_type, source_path: source.source_path, reason: read.reason });
      continue;
    }
    const stat = fs.statSync(source.absPath);
    const rawChunks = chunkMarkdown({
      text: read.text,
      sourcePath: source.source_path,
      sourceType: source.source_type,
      maxChunkChars: config.maxChunkChars,
      maxChunksPerSource: config.maxChunksPerSource,
    });
    const sourceHash = hashText(read.text);
    sourceMap.push({
      source_type: source.source_type,
      source_path: source.source_path,
      source_role: sourceRole(source.source_type, source.source_path),
      hash: sourceHash,
      modified_time: stat.mtime.toISOString(),
      chunk_count: rawChunks.length,
    });

    for (let i = 0; i < rawChunks.length; i += 1) {
      const chunk = rawChunks[i];
      const textHash = hashText(chunk.text);
      chunks.push({
        id: `rbmem_${hashText(`${chunk.source_type}|${chunk.source_path}|${i}|${textHash}`).slice(0, 16)}`,
        ...chunk,
        hash: textHash,
        modified_time: stat.mtime.toISOString(),
        char_count: chunk.text.length,
        embedding_model: null,
        has_embedding: false,
      });
    }
  }

  chunks.sort((a, b) => {
    const priority = (SOURCE_PRIORITY[a.source_role] ?? 9) - (SOURCE_PRIORITY[b.source_role] ?? 9);
    if (priority !== 0) return priority;
    return `${a.source_type}:${a.source_path}:${a.id}`.localeCompare(`${b.source_type}:${b.source_path}:${b.id}`);
  });

  return { chunks, sourceMap, skipped };
}

async function getOllamaTags() {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }
  return res.json();
}

function parseModelNames(tags) {
  const models = Array.isArray(tags?.models) ? tags.models : [];
  return models.map((model) => model?.name).filter(Boolean);
}

function isLikelySmallModel(name) {
  return /(0\.5b|1b|1\.5b|2b|3b|mini|small)/i.test(name);
}

function pickChatModel(modelNames, config) {
  if (MODEL_OVERRIDE) return { model: MODEL_OVERRIDE, source: 'REDBYTE_AGENT_MODEL' };
  if (config.chatModel && config.chatModel !== 'auto') return { model: config.chatModel, source: 'memory config' };
  for (const model of PREFERRED_CHAT_MODELS) {
    if (modelNames.includes(model)) return { model, source: 'installed preferred model' };
  }
  const small = modelNames.find((name) => isLikelySmallModel(name));
  if (small) return { model: small, source: 'installed small model' };
  return { model: DEFAULT_CHAT_MODEL, source: 'fallback default' };
}

function pickEmbeddingModel(modelNames, config) {
  const configured = config.embeddingModel || PREFERRED_EMBEDDING_MODELS[0];
  if (modelNames.includes(configured)) return { model: configured, available: true };
  for (const model of PREFERRED_EMBEDDING_MODELS) {
    if (modelNames.includes(model)) return { model, available: true };
  }
  return { model: configured, available: false };
}

async function resolveChatModel(config) {
  const tags = await getOllamaTags();
  const modelNames = parseModelNames(tags);
  const selected = pickChatModel(modelNames, config);
  return { ...selected, modelNames };
}

async function resolveEmbeddingModel(config) {
  const tags = await getOllamaTags();
  const modelNames = parseModelNames(tags);
  return { ...pickEmbeddingModel(modelNames, config), modelNames };
}

async function ollamaChat({ model, system, user, format = undefined }) {
  const payload = {
    model,
    stream: false,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: {
      temperature: TEMPERATURE,
      num_ctx: 8192,
    },
  };
  if (format) payload.format = format;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama chat failed HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }
  const json = await res.json();
  return json?.message?.content ?? '';
}

async function embedText(model, text) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama embed failed HTTP ${res.status}${body ? `: ${body}` : ''}`);
  }
  const json = await res.json();
  const embeddings = json?.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) return embeddings[0];
  if (Array.isArray(json?.embedding)) return json.embedding;
  throw new Error('Ollama embed response did not contain an embedding vector.');
}

async function embedBatch(model, texts) {
  const out = [];
  for (const text of texts) {
    out.push(await embedText(model, text));
  }
  return out;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function indexPaths(config) {
  return {
    dir: config.indexOutputDirResolved,
    manifest: path.join(config.indexOutputDirResolved, 'manifest.json'),
    sourceMap: path.join(config.indexOutputDirResolved, 'source-map.json'),
    chunks: path.join(config.indexOutputDirResolved, 'chunks.jsonl'),
    embeddings: path.join(config.indexOutputDirResolved, 'embeddings.jsonl'),
  };
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readIndex(config) {
  const paths = indexPaths(config);
  if (!fs.existsSync(paths.chunks)) {
    fail('Memory index not found. Run: pnpm rb:memory:index');
  }
  const chunks = readJsonl(paths.chunks);
  const embeddings = fs.existsSync(paths.embeddings) ? readJsonl(paths.embeddings) : [];
  const embeddingById = new Map(embeddings.map((row) => [row.id, row]));
  return { chunks, embeddings, embeddingById, paths };
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_:-]{2,}/g) || [])
    .filter((term) => !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into'].includes(term));
}

function keywordSearch(chunks, query, limit = 8) {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return chunks.map((chunk) => {
    const haystack = `${chunk.title}\n${chunk.heading_path.join(' > ')}\n${chunk.source_path}\n${chunk.text}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = haystack.match(re);
      if (matches) score += matches.length;
    }
    score += Math.max(0, 5 - (SOURCE_PRIORITY[chunk.source_role] ?? 5)) * 0.15;
    return { chunk, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.source_path.localeCompare(b.chunk.source_path))
    .slice(0, limit);
}

async function searchIndex(config, query, { limit = 8 } = {}) {
  const { chunks, embeddingById } = readIndex(config);
  const embeddingRows = [...embeddingById.values()];
  if (embeddingRows.length > 0) {
    const model = embeddingRows[0].embedding_model;
    try {
      const queryEmbedding = await embedText(model, query);
      const scored = chunks.map((chunk) => {
        const row = embeddingById.get(chunk.id);
        if (!row?.embedding) return { chunk, score: -1 };
        const priorityBoost = Math.max(0, 5 - (SOURCE_PRIORITY[chunk.source_role] ?? 5)) * 0.01;
        return { chunk, score: cosineSimilarity(queryEmbedding, row.embedding) + priorityBoost };
      })
        .filter((row) => row.score >= 0)
        .sort((a, b) => b.score - a.score || a.chunk.source_path.localeCompare(b.chunk.source_path))
        .slice(0, limit);
      return { mode: 'embedding', results: scored };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      info(`[warn] Embedding search failed; falling back to keyword search. ${reason}`);
    }
  }
  return { mode: 'keyword', results: keywordSearch(chunks, query, limit) };
}

function excerpt(text, query = '', maxLen = 280) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const terms = tokenize(query);
  const lower = clean.toLowerCase();
  const idx = terms.map((term) => lower.indexOf(term)).filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, idx - 80);
  return `${start > 0 ? '...' : ''}${clean.slice(start, start + maxLen)}${start + maxLen < clean.length ? '...' : ''}`;
}

function formatSearchResults({ mode, results }, query) {
  const lines = [
    '# RedByte Memory Search',
    '',
    `- Query: ${query}`,
    `- Mode: ${mode}`,
    '',
  ];
  if (results.length === 0) {
    lines.push('No matching chunks found.');
    return lines.join('\n');
  }
  for (let i = 0; i < results.length; i += 1) {
    const { chunk, score } = results[i];
    lines.push(`## ${i + 1}. ${chunk.source_path}`);
    lines.push('');
    lines.push(`- Source type: ${chunk.source_type === 'repo' ? 'repo truth/docs' : 'Obsidian memory'}`);
    lines.push(`- Source role: ${chunk.source_role}`);
    lines.push(`- Heading: ${chunk.heading_path.join(' > ') || chunk.title}`);
    lines.push(`- Score: ${score.toFixed(4)}`);
    lines.push('');
    lines.push(excerpt(chunk.text, query));
    lines.push('');
  }
  return lines.join('\n');
}

function sourceSummary(results) {
  return results.map(({ chunk, score }) => ({
    source_path: chunk.source_path,
    source_type: chunk.source_type,
    source_role: chunk.source_role,
    heading_path: chunk.heading_path,
    score: Number(score.toFixed(4)),
    excerpt: excerpt(chunk.text, '', 420),
  }));
}

function readControlContext() {
  const parts = [];
  for (const rel of REQUIRED_REPO_DOCS) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) {
      const text = rel === 'AI_STATE.md'
        ? trimAiState(fs.readFileSync(abs, 'utf8'))
        : fs.readFileSync(abs, 'utf8').slice(0, 12000);
      parts.push(`## ${rel}\n\n${text}`);
    }
  }
  const status = git('status --short', { allowFailure: true }) || '(clean)';
  const log = git('log --oneline -8', { allowFailure: true }) || '(unavailable)';
  parts.push(`## Git status\n\n${status}`);
  parts.push(`## Recent commits\n\n${log}`);
  return parts.join('\n\n---\n\n');
}

function memorySystemPrompt() {
  return [
    'You are the RedByte Product Memory Bridge.',
    'You answer from provided repo truth, traceability evidence, and Obsidian memory chunks.',
    'Source hierarchy is mandatory:',
    '1. Current repo truth and git state win.',
    '2. Product contracts/specs define target state, not shipped state.',
    '3. Surface specs and manuals describe current/architecture details.',
    '4. Obsidian is working memory only and cannot override repo truth.',
    '5. Historical/stale docs are cautionary only.',
    'Never invent shipped features. Mark aspirational claims as aspirational.',
    'Never propose vault writes; propose a sync plan only.',
    'Keep product spine intact: Project -> Design -> Verify -> Map Pins / Hardware -> Export.',
    'If asked what RedByte is right now, answer from RED_BYTE_CURRENT_TRUTH.md and ACTIVE_WORK.md first.',
    'Do not describe the local agent, memory bridge, or tooling as the product unless the user explicitly asks about tooling.',
  ].join('\n');
}

function currentTruthSnapshot() {
  const docs = [
    'docs/product/RED_BYTE_CURRENT_TRUTH.md',
    'docs/ACTIVE_WORK.md',
    'docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md',
  ];
  const snippets = [];
  for (const rel of docs) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const productThesis = text.match(/## 2\. Current product thesis\s+([\s\S]*?)(?=\n## |$)/);
    const currentUx = text.match(/## 3\. Current UX spine\s+([\s\S]*?)(?=\n## |$)/);
    const whatIs = text.match(/## 1\. What RedByte Is\s+([\s\S]*?)(?=\n## |$)/);
    const overview = text.match(/## What is broken right now\s+([\s\S]*?)(?=\n## |$)/);
    snippets.push([
      `# ${rel}`,
      productThesis?.[1]?.trim() || '',
      currentUx?.[1]?.trim() || '',
      whatIs?.[1]?.trim() || '',
      overview?.[1]?.trim() || '',
    ].filter(Boolean).join('\n\n'));
  }
  return snippets.join('\n\n---\n\n');
}

function schemas(kind) {
  const common = {
    type: 'object',
    additionalProperties: false,
  };
  const fields = {
    synth: {
      answer: { type: 'string' },
      source_files_used: { type: 'array', items: { type: 'string' } },
      repo_truth_summary: { type: 'string' },
      obsidian_memory_summary: { type: 'string' },
      conflicts_stale_claims: { type: 'array', items: { type: 'string' } },
      traceability_status: { type: 'string' },
      recommended_next_action: { type: 'string' },
      confidence: { type: 'string' },
      what_not_to_do: { type: 'array', items: { type: 'string' } },
    },
    syncPlan: {
      repo_facts_missing_from_obsidian: { type: 'array', items: { type: 'string' } },
      obsidian_claims_contradicted_by_repo_truth: { type: 'array', items: { type: 'string' } },
      stale_notes: { type: 'array', items: { type: 'string' } },
      missing_decision_records: { type: 'array', items: { type: 'string' } },
      suggested_vault_updates: { type: 'array', items: { type: 'string' } },
      suggested_repo_doc_updates: { type: 'array', items: { type: 'string' } },
      exact_files_likely_involved: { type: 'array', items: { type: 'string' } },
      safe_repo_doc_updates: { type: 'array', items: { type: 'string' } },
      suggested_obsidian_updates: { type: 'array', items: { type: 'string' } },
      conflicts_needing_user_decision: { type: 'array', items: { type: 'string' } },
      do_not_update_items: { type: 'array', items: { type: 'string' } },
      product_claims_needing_tests_gates: { type: 'array', items: { type: 'string' } },
      next_session_prompt_recommendation: { type: 'string' },
      no_write_notice: { type: 'string' },
    },
    trace: {
      claim: { type: 'string' },
      current_truth_status: { type: 'string' },
      repo_docs_supporting_it: { type: 'array', items: { type: 'string' } },
      code_files_likely_responsible: { type: 'array', items: { type: 'string' } },
      tests_gates_proving_it: { type: 'array', items: { type: 'string' } },
      missing_tests: { type: 'array', items: { type: 'string' } },
      stale_conflicting_obsidian_notes: { type: 'array', items: { type: 'string' } },
      recommended_next_action: { type: 'string' },
      evidence_level: { type: 'string' },
    },
    nextContext: {
      next_product_task: { type: 'string' },
      why_it_matters: { type: 'string' },
      current_state: { type: 'string' },
      source_docs: { type: 'array', items: { type: 'string' } },
      relevant_code_files: { type: 'array', items: { type: 'string' } },
      tests_gates: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' } },
      do_not_touch: { type: 'array', items: { type: 'string' } },
      copilot_ready_prompt: { type: 'string' },
    },
  };
  return {
    ...common,
    properties: fields[kind],
    required: Object.keys(fields[kind]),
  };
}

function validateRequiredJson(raw, kind) {
  const schema = schemas(kind);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), parsed: null };
  }
  const missing = schema.required.filter((key) => !(key in parsed));
  if (missing.length > 0) {
    return { ok: false, error: `missing keys: ${missing.join(', ')}`, parsed };
  }
  return { ok: true, error: '', parsed };
}

function markdownFromJson(title, payload) {
  const lines = [`# ${title}`, '', `_Generated ${new Date().toISOString()}_`, ''];
  for (const [key, value] of Object.entries(payload)) {
    lines.push(`## ${key.replace(/_/g, ' ')}`);
    lines.push('');
    if (Array.isArray(value)) {
      lines.push(value.length ? value.map((item) => `- ${item}`).join('\n') : '- none');
    } else {
      lines.push(String(value));
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function structuredOrMarkdown({ config, kind, title, user, outBase, transform = null }) {
  const { model } = await resolveChatModel(config);
  const schema = schemas(kind);
  let raw = '';
  try {
    raw = await ollamaChat({
      model,
      system: memorySystemPrompt(),
      user,
      format: schema,
    });
    const validated = validateRequiredJson(raw, kind);
    if (validated.ok) {
      const payload = transform ? transform(validated.parsed) : validated.parsed;
      const jsonPath = writeGenerated(path.join(RUNS_DIR, `${outBase}.json`), `${JSON.stringify(payload, null, 2)}\n`);
      const mdPath = writeGenerated(path.join(RUNS_DIR, `${outBase}.md`), markdownFromJson(title, payload));
      info(`[ok] Structured JSON written: ${jsonPath}`);
      info(`[ok] Markdown companion written: ${mdPath}`);
      process.stdout.write(`${markdownFromJson(title, payload)}\n`);
      return { mode: 'json', output: mdPath };
    }
    const debugPath = writeGenerated(path.join(RUNS_DIR, `${outBase}-invalid-json.txt`), raw);
    info(`[warn] Structured JSON failed (${validated.error}). Raw output saved: ${debugPath}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const debugPath = writeGenerated(path.join(RUNS_DIR, `${outBase}-json-error.txt`), `${reason}\n\n${raw}`);
    info(`[warn] Structured JSON request failed. Debug output saved: ${debugPath}`);
  }

  const fallback = await ollamaChat({
    model,
    system: memorySystemPrompt(),
    user: `${user}\n\nReturn Markdown with the same required sections. Do not return JSON.`,
  });
  const md = `# ${title}\n\n_Generated ${new Date().toISOString()}_\n_Model: ${model}_\n_Fallback: markdown because structured JSON was invalid or unavailable._\n\n---\n\n${fallback}`;
  const mdPath = writeGenerated(path.join(RUNS_DIR, `${outBase}.md`), md);
  info(`[ok] Markdown fallback written: ${mdPath}`);
  process.stdout.write(`${md}\n`);
  return { mode: 'markdown', output: mdPath };
}

function formatEvidenceContext(results) {
  return JSON.stringify(sourceSummary(results), null, 2).slice(0, 18000);
}

function findRepoEvidence(query, { limit = 60 } = {}) {
  const terms = tokenize(query).filter((term) => term.length > 2);
  if (terms.length === 0) return [];
  const candidates = git('ls-files', { allowFailure: true }).split(/\r?\n/)
    .filter(Boolean)
    .filter((rel) => {
      const p = toPosix(rel);
      if (!/\.(md|mjs|js|ts|tsx|json)$/.test(p)) return false;
      if (/^(node_modules|dist|coverage|out|artifacts|test-results|playwright-report)\//.test(p)) return false;
      if (/^\.redbyte\/agent\/runs\//.test(p)) return false;
      return /^(docs|packages|scripts|tests|\.github|\.redbyte)/.test(p) || p === 'package.json' || p === 'AI_STATE.md';
    });
  const rows = [];
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let text = '';
    try {
      const stat = fs.statSync(abs);
      if (stat.size > 350000) continue;
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lower = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (lower.includes(term)) score += 1;
    }
    if (score > 0) {
      rows.push({ path: toPosix(rel), score, kind: evidenceKind(rel) });
    }
  }
  return rows.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}

function evidenceKind(rel) {
  if (rel.includes('__tests__') || rel.startsWith('tests/')) return 'test';
  if (rel.startsWith('scripts/gates/') || rel.includes('gate')) return 'gate';
  if (rel.startsWith('packages/')) return 'code';
  if (rel.startsWith('docs/')) return 'doc';
  return 'other';
}

function staleMemorySignals(results) {
  const staleTerms = [
    'time-travel',
    '3d editing',
    'redbyte os',
    'fpga bridge as shipped',
    'auto-generate circuits',
    'replaces vivado',
    'all circuits',
  ];
  const findings = [];
  for (const { chunk } of results) {
    if (chunk.source_type !== 'obsidian') continue;
    const lower = chunk.text.toLowerCase();
    for (const term of staleTerms) {
      if (lower.includes(term)) findings.push(`${chunk.source_path}: contains possible stale claim "${term}"`);
    }
  }
  return findings;
}

function deriveTraceFallback(claim, searchResults, repoEvidence) {
  const docs = [
    ...new Set([
      ...searchResults
        .map(({ chunk }) => chunk)
        .filter((chunk) => chunk.source_type === 'repo' && chunk.source_path.endsWith('.md'))
        .map((chunk) => chunk.source_path),
      ...repoEvidence.filter((row) => row.kind === 'doc').map((row) => row.path),
    ]),
  ].slice(0, 12);
  const code = [...new Set(repoEvidence.filter((row) => row.kind === 'code').map((row) => row.path))].slice(0, 12);
  const tests = [...new Set(repoEvidence.filter((row) => row.kind === 'test' || row.kind === 'gate').map((row) => row.path))].slice(0, 12);
  const stale = staleMemorySignals(searchResults);
  let status = 'unknown';
  if (docs.length > 0 && code.length > 0 && tests.length > 0) status = 'implemented';
  else if (docs.length > 0 && (code.length > 0 || tests.length > 0)) status = 'partially implemented';
  else if (docs.length > 0) status = 'aspirational';

  let evidenceLevel = 'L0: documented only';
  if (code.length > 0) evidenceLevel = 'L1: code exists';
  if (tests.length > 0) evidenceLevel = 'L2: unit/integration test exists';
  if (tests.some((item) => item.includes('scripts/gates/') || item.includes('tests/e2e/'))) {
    evidenceLevel = 'L3: browser/workflow gate exists';
  }

  return {
    claim,
    current_truth_status: status,
    repo_docs_supporting_it: docs,
    code_files_likely_responsible: code,
    tests_gates_proving_it: tests,
    missing_tests: tests.length > 0 ? [] : ['No focused test or gate was found by the memory bridge keyword scan.'],
    stale_conflicting_obsidian_notes: stale,
    recommended_next_action: tests.length > 0
      ? 'Keep the claim scoped to the cited evidence and update traceability if the behavior changes.'
      : 'Add or identify focused tests/gates before making this claim stronger.',
    evidence_level: evidenceLevel,
  };
}

async function cmdDoctor() {
  const config = loadConfig({ allowMissingPrivate: true });
  info('Running RedByte memory bridge doctor...');
  info(`[ok] Repo root: ${ROOT}`);
  info(fs.existsSync(CONFIG_EXAMPLE) ? `[ok] Config example: ${relFromRoot(CONFIG_EXAMPLE)}` : '[missing] config.example.json');
  if (config.hasPrivateConfig) {
    info(`[ok] Private config present: ${relFromRoot(PRIVATE_CONFIG)}`);
  } else {
    info(`[warn] Private config not present. Using safe example defaults. To override: copy ${relFromRoot(CONFIG_EXAMPLE)} to ${relFromRoot(PRIVATE_CONFIG)}.`);
  }

  for (const glob of [...config.includeVaultGlobs, ...config.excludeVaultGlobs, ...config.excludeRepoGlobs]) {
    try {
      globToRegExp(glob);
    } catch (error) {
      fail(`Invalid glob in memory config: ${glob}`, [error instanceof Error ? error.message : String(error)]);
    }
  }
  info('[ok] Include/exclude globs compiled.');

  if (!config.obsidianVaultPath || config.obsidianVaultPath === '__FILL_IN__') {
    fail('Obsidian vault path is not configured.', [
      `Copy ${relFromRoot(CONFIG_EXAMPLE)} to ${relFromRoot(PRIVATE_CONFIG)} and set obsidianVaultPath.`,
      'Use a relative path when the vault is in the repo root.',
    ]);
  }
  if (!fs.existsSync(config.obsidianVaultPathResolved)) {
    fail('Configured Obsidian vault path does not exist.', [config.obsidianVaultPathResolved]);
  }
  info(`[ok] Obsidian vault path exists: ${config.obsidianVaultPath}`);

  const missingDocs = REQUIRED_REPO_DOCS.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missingDocs.length > 0) fail('Required repo control docs are missing.', missingDocs);
  info('[ok] Required repo control docs exist.');

  if (config.allowVaultWrites) {
    fail('allowVaultWrites must be false for v0.', ['Set allowVaultWrites to false in memory config.']);
  }
  info('[ok] Vault write mode disabled.');

  const indexRel = toPosix(path.relative(ROOT, path.join(config.indexOutputDirResolved, 'chunks.jsonl')));
  const runsRel = '.redbyte/agent/runs/memory-synth-latest.md';
  if (!isIgnoredByGit(indexRel)) {
    fail('Memory index output is not gitignored.', [indexRel]);
  }
  if (!isIgnoredByGit(runsRel)) {
    fail('Memory run output is not gitignored.', [runsRel]);
  }
  info('[ok] Generated index/run outputs are gitignored.');

  let tags;
  try {
    tags = await getOllamaTags();
  } catch (error) {
    fail('Ollama API is not reachable.', [
      `URL: ${OLLAMA_BASE_URL}/api/tags`,
      error instanceof Error ? error.message : String(error),
      'Start command: Start-Process ollama',
    ]);
  }
  const modelNames = parseModelNames(tags);
  info(`[ok] Ollama API reachable; installed models: ${modelNames.join(', ') || 'none'}`);
  const chat = pickChatModel(modelNames, config);
  if (!modelNames.includes(chat.model)) {
    fail('Chat model is not installed.', [
      `Selected: ${chat.model}`,
      `Install: ollama pull ${chat.model}`,
    ]);
  }
  info(`[ok] Chat model available: ${chat.model} (${chat.source})`);

  const embedding = pickEmbeddingModel(modelNames, config);
  if (embedding.available) {
    info(`[ok] Embedding model available: ${embedding.model}`);
  } else {
    info(`[warn] Embedding model not installed: ${embedding.model}`);
    info('[warn] Index/search will use keyword fallback unless you run: ollama pull all-minilm');
    info('[warn] Alternative: ollama pull embeddinggemma');
  }

  info('doctor complete.');
}

async function cmdIndex() {
  const config = loadConfig({ allowMissingPrivate: true });
  assertInside(config.indexOutputDirResolved, path.join(ROOT, '.redbyte', 'agent', 'memory'), 'indexOutputDir');
  const paths = indexPaths(config);
  const { sources, skipped: sourceSkipped } = buildSources(config);
  const { chunks, sourceMap, skipped: chunkSkipped } = materializeChunks(config, sources);

  let embeddingModel = null;
  let embeddings = [];
  try {
    const resolved = await resolveEmbeddingModel(config);
    if (resolved.available) {
      embeddingModel = resolved.model;
      info(`Embedding ${chunks.length} chunks with ${embeddingModel}...`);
      const vectors = await embedBatch(embeddingModel, chunks.map((chunk) => chunk.text));
      embeddings = chunks.map((chunk, index) => {
        chunk.embedding_model = embeddingModel;
        chunk.has_embedding = true;
        return {
          id: chunk.id,
          source_path: chunk.source_path,
          embedding_model: embeddingModel,
          embedding: vectors[index],
        };
      });
    } else {
      info(`[warn] Embedding model unavailable (${resolved.model}); writing keyword-only index.`);
    }
  } catch (error) {
    info(`[warn] Embedding failed; writing keyword-only index. ${error instanceof Error ? error.message : String(error)}`);
  }

  fs.mkdirSync(paths.dir, { recursive: true });
  appendJsonl(paths.chunks, chunks);
  if (embeddings.length > 0) appendJsonl(paths.embeddings, embeddings);
  if (embeddings.length === 0 && fs.existsSync(paths.embeddings)) fs.rmSync(paths.embeddings);
  writeGenerated(paths.sourceMap, `${JSON.stringify(sourceMap, null, 2)}\n`);
  const manifest = {
    generated_at: new Date().toISOString(),
    repo_root: ROOT,
    vault_path_configured: config.obsidianVaultPath || '',
    source_count: sourceMap.length,
    chunk_count: chunks.length,
    embedding_model: embeddingModel,
    embedded_chunk_count: embeddings.length,
    skipped: [...sourceSkipped, ...chunkSkipped],
    source_hierarchy: config.productTruthPriority,
    allow_vault_writes: config.allowVaultWrites,
  };
  writeGenerated(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  info(`[ok] Index manifest: ${paths.manifest}`);
  info(`[ok] Source map: ${paths.sourceMap}`);
  info(`[ok] Chunks: ${paths.chunks}`);
  if (embeddings.length > 0) info(`[ok] Embeddings: ${paths.embeddings}`);
  process.stdout.write(`${JSON.stringify({
    source_count: sourceMap.length,
    chunk_count: chunks.length,
    embedded_chunk_count: embeddings.length,
    skipped_count: manifest.skipped.length,
  }, null, 2)}\n`);
}

async function cmdSearch(query) {
  if (!query) fail('Missing search query.', ['Usage: pnpm rb:memory:search -- "query text"']);
  const config = loadConfig({ allowMissingPrivate: true });
  const result = await searchIndex(config, query, { limit: 10 });
  process.stdout.write(`${formatSearchResults(result, query)}\n`);
}

async function cmdSynth(question) {
  if (!question) fail('Missing question.', ['Usage: pnpm rb:memory:synth -- "What is RedByte right now?"']);
  const config = loadConfig({ allowMissingPrivate: true });
  const search = await searchIndex(config, question, { limit: 10 });
  const context = readControlContext();
  await structuredOrMarkdown({
    config,
    kind: 'synth',
    title: 'RedByte Memory Synthesis',
    outBase: 'memory-synth-latest',
    user: [
      `Question: ${question}`,
      '',
      'Mandatory product-current snapshot. Use this before memory chunks for product-definition questions:',
      currentTruthSnapshot().slice(0, 8000),
      '',
      'Current repo control context:',
      context.slice(0, 16000),
      '',
      `Memory search mode: ${search.mode}`,
      'Memory chunks:',
      formatEvidenceContext(search.results),
      '',
      `Possible stale Obsidian signals: ${JSON.stringify(staleMemorySignals(search.results), null, 2)}`,
    ].join('\n'),
  });
}

async function cmdSyncPlan() {
  const config = loadConfig({ allowMissingPrivate: true });
  const search = await searchIndex(config, 'RedByte current truth product spine active work Obsidian stale conflict session log', { limit: 14 });
  await structuredOrMarkdown({
    config,
    kind: 'syncPlan',
    title: 'RedByte Obsidian Sync Plan',
    outBase: 'obsidian-sync-plan',
    user: [
      'Compare repo truth and Obsidian memory. Produce a no-write sync plan only.',
      'Distinguish repo current truth missing from Obsidian, Obsidian notes stale against repo, product claims lacking code/test support, queue/work-driver stale against commits, Session Log needs, AI_STATE needs, and decision-record needs.',
      'Use these actionable sections exactly: safe repo doc updates, suggested Obsidian updates, conflicts needing user decision, do-not-update items, product claims needing tests/gates, next session prompt recommendation.',
      '',
      'Repo control context:',
      readControlContext().slice(0, 18000),
      '',
      'Recent work-driver status:',
      git('status --short', { allowFailure: true }) || '(clean)',
      '',
      'Recent commits:',
      git('log --oneline -15', { allowFailure: true }),
      '',
      `Memory search mode: ${search.mode}`,
      'Memory chunks:',
      formatEvidenceContext(search.results),
      '',
      `Possible stale memory signals: ${JSON.stringify(staleMemorySignals(search.results), null, 2)}`,
    ].join('\n'),
  });
}

async function cmdTrace(claim) {
  if (!claim) fail('Missing claim.', ['Usage: pnpm rb:memory:trace -- "Map Pins does not replace Verify proof"']);
  const config = loadConfig({ allowMissingPrivate: true });
  const search = await searchIndex(config, claim, { limit: 14 });
  const repoEvidence = findRepoEvidence(claim);
  const deterministicTrace = deriveTraceFallback(claim, search.results, repoEvidence);
  await structuredOrMarkdown({
    config,
    kind: 'trace',
    title: 'RedByte Product Traceability Report',
    outBase: 'trace-latest',
    transform: (parsed) => ({
      ...parsed,
      claim,
      current_truth_status: deterministicTrace.current_truth_status,
      repo_docs_supporting_it: deterministicTrace.repo_docs_supporting_it,
      code_files_likely_responsible: deterministicTrace.code_files_likely_responsible,
      tests_gates_proving_it: deterministicTrace.tests_gates_proving_it,
      missing_tests: deterministicTrace.missing_tests,
      stale_conflicting_obsidian_notes: deterministicTrace.stale_conflicting_obsidian_notes,
      evidence_level: deterministicTrace.evidence_level,
      recommended_next_action: deterministicTrace.recommended_next_action,
    }),
    user: [
      `Trace this RedByte product claim: ${claim}`,
      '',
      'Preserve the claim text exactly. Do not replace it with another issue.',
      '',
      'Deterministic trace prefill from local search. Use this unless you find a direct contradiction:',
      JSON.stringify(deterministicTrace, null, 2),
      '',
      'Classify current_truth_status as one of: implemented, partially implemented, aspirational, contradicted, unknown.',
      'Use evidence levels L0-L5 from docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md if present.',
      '',
      'Repo control context:',
      readControlContext().slice(0, 14000),
      '',
      'Repo keyword evidence:',
      JSON.stringify(repoEvidence, null, 2),
      '',
      `Memory search mode: ${search.mode}`,
      'Memory chunks:',
      formatEvidenceContext(search.results),
      '',
      `Possible stale/conflicting Obsidian signals: ${JSON.stringify(staleMemorySignals(search.results), null, 2)}`,
    ].join('\n'),
  });
}

async function cmdNextProductContext() {
  const config = loadConfig({ allowMissingPrivate: true });
  const search = await searchIndex(config, 'next product slice active work work queue Export duplicate heading proof closure', { limit: 12 });
  const packetPath = path.join(ROOT, '.redbyte', 'work', 'NEXT_WORK_PACKET.md');
  const packet = fs.existsSync(packetPath) ? fs.readFileSync(packetPath, 'utf8') : '(missing - run pnpm rb:work:next)';
  await structuredOrMarkdown({
    config,
    kind: 'nextContext',
    title: 'RedByte Next Product Context',
    outBase: 'next-product-context',
    user: [
      'Generate a source-backed context pack for the next product slice.',
      '',
      'Work-driver packet:',
      packet.slice(0, 12000),
      '',
      'Repo control context:',
      readControlContext().slice(0, 12000),
      '',
      `Memory search mode: ${search.mode}`,
      'Memory chunks:',
      formatEvidenceContext(search.results),
      '',
      'Do not start product code in this command. Generate context only.',
    ].join('\n'),
  });
}

async function cmdHandoff() {
  const config = loadConfig({ allowMissingPrivate: true });
  const search = await searchIndex(config, 'handoff current state latest commits active work session log Obsidian', { limit: 10 });
  const status = git('status --short', { allowFailure: true }) || '(clean)';
  const log = git('log --oneline -12', { allowFailure: true });
  const branch = git('rev-parse --abbrev-ref HEAD', { allowFailure: true }) || 'unknown';
  const context = [
    `# RedByte Memory Handoff`,
    '',
    `_Generated ${new Date().toISOString()}_`,
    '',
    `- Branch: ${branch}`,
    `- Git status: ${status}`,
    '',
    '## Recent commits',
    '',
    log,
    '',
    '## Repo control context',
    '',
    readControlContext().slice(0, 16000),
    '',
    `## Memory search mode: ${search.mode}`,
    '',
    formatEvidenceContext(search.results),
  ].join('\n');
  const out = writeGenerated(path.join(RUNS_DIR, 'memory-handoff-latest.md'), context);
  info(`[ok] Memory handoff written: ${out}`);
  process.stdout.write(`${context}\n`);
}

function usage() {
  process.stdout.write(
    '\nRedByte Obsidian Memory Bridge\n\n' +
    'Usage:\n' +
    '  pnpm rb:memory:doctor\n' +
    '  pnpm rb:memory:index\n' +
    '  pnpm rb:memory:search -- "query text"\n' +
    '  pnpm rb:memory:synth -- "question"\n' +
    '  pnpm rb:memory:sync-plan\n' +
    '  pnpm rb:memory:trace -- "claim or feature"\n' +
    '  pnpm rb:memory:next-product-context\n' +
    '  pnpm rb:memory:handoff\n\n'
  );
}

const COMMANDS = {
  doctor: () => cmdDoctor(),
  index: () => cmdIndex(),
  search: () => cmdSearch(process.argv.slice(3).join(' ').trim()),
  synth: () => cmdSynth(process.argv.slice(3).join(' ').trim()),
  'sync-plan': () => cmdSyncPlan(),
  trace: () => cmdTrace(process.argv.slice(3).join(' ').trim()),
  'next-product-context': () => cmdNextProductContext(),
  handoff: () => cmdHandoff(),
};

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const command = process.argv[2];
  if (!command || !COMMANDS[command]) {
    usage();
    process.exit(command ? 1 : 0);
  }
  COMMANDS[command]().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}

export {
  chunkMarkdown,
  cosineSimilarity,
  findRepoEvidence,
  globToRegExp,
  keywordSearch,
  loadConfig,
  sourceRole,
  tokenize,
};
