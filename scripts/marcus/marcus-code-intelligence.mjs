#!/usr/bin/env node
/**
 * marcus-code-intelligence.mjs
 *
 * Read-only code context and proposal-only patch planning for Marcus HQ.
 * This module never edits repo files. It only reads allowlisted text files and
 * writes generated proposal artifacts under .redbyte/agent/runs/hq/patch-proposals/.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_MAX_FILE_BYTES = 220 * 1024;
const DEFAULT_MAX_READ_CHARS = 16 * 1024;
const DEFAULT_MAX_SNIPPETS = 20;
const DEFAULT_MAX_FILES = 2500;

const ALLOWED_DIRS = [
  'packages',
  'scripts',
  'docs',
  '.github/instructions',
  '.github/prompts',
  '.redbyte/agent/skills',
];

const ALLOWED_ROOT_FILES = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'vitest.config.ts',
  'vite.config.ts',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ps1',
  '.ts', '.tsx', '.txt', '.yml', '.yaml',
]);

function normalizeRelPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
}

function clip(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function nowIdStamp() {
  return new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
}

export function sanitizeProposalId(id) {
  const value = String(id || '').trim();
  if (!/^[a-zA-Z0-9_\-.]{1,140}$/.test(value)) {
    throw new Error(`Invalid proposal id: ${JSON.stringify(value)}`);
  }
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new Error(`Proposal id contains path traversal: ${JSON.stringify(value)}`);
  }
  return value;
}

export function ensureInsideRepo(repoRoot, targetPath) {
  const resolvedRoot = path.resolve(repoRoot);
  const resolved = path.resolve(targetPath);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path escapes repo root: ${resolved}`);
  }
  return resolved;
}

export function isDeniedPath(relPath) {
  const rel = normalizeRelPath(relPath);
  const lower = rel.toLowerCase();
  if (!rel || rel.includes('\0')) return true;
  if (rel.startsWith('../') || rel === '..' || rel.includes('/../')) return true;
  if (lower === '.git' || lower.startsWith('.git/')) return true;
  if (lower === 'node_modules' || lower.includes('/node_modules/')) return true;
  if (lower === 'dist' || lower.startsWith('dist/') || lower.includes('/dist/')) return true;
  if (lower === 'build' || lower.startsWith('build/') || lower.includes('/build/')) return true;
  if (lower === 'out' || lower.startsWith('out/') || lower.includes('/out/')) return true;
  if (lower === '.cache' || lower.startsWith('.cache/') || lower.includes('/.cache/')) return true;
  if (lower.startsWith('.redbyte/agent/runs/')) return true;
  if (/^\.env($|[./])/.test(lower) || lower.startsWith('.env.')) return true;
  if (lower.startsWith('.redbyte/agent/') && lower.endsWith('/config.json')) return true;
  if (lower === '.redbyte/agent/config.json') return true;
  return false;
}

export function isAllowedCodePath(relPath) {
  const rel = normalizeRelPath(relPath);
  if (isDeniedPath(rel)) return false;
  if (ALLOWED_ROOT_FILES.has(rel)) return true;
  if (/^packages\/[^/]+\/package\.json$/i.test(rel)) return true;
  if (/^packages\/[^/]+\/tsconfig[^/]*\.json$/i.test(rel)) return true;
  if (/^apps\/[^/]+\/package\.json$/i.test(rel)) return true;
  if (/^apps\/[^/]+\/tsconfig[^/]*\.json$/i.test(rel)) return true;
  return ALLOWED_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
}

function isTextFilePath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function assertReadableCodeFile(repoRoot, relPath, options = {}) {
  const rel = normalizeRelPath(relPath);
  if (!isAllowedCodePath(rel)) {
    throw new Error(`Path is not allowed for Marcus code reads: ${rel}`);
  }
  if (!isTextFilePath(rel)) {
    throw new Error(`Only known text files may be read: ${rel}`);
  }
  const abs = ensureInsideRepo(repoRoot, path.join(repoRoot, rel));
  const stat = fs.statSync(abs);
  if (!stat.isFile()) throw new Error(`Not a file: ${rel}`);
  const maxFileBytes = options.maxFileBytes || DEFAULT_MAX_FILE_BYTES;
  if (stat.size > maxFileBytes) {
    throw new Error(`File exceeds read limit (${stat.size} > ${maxFileBytes}): ${rel}`);
  }
  return { rel, abs, stat };
}

function isLikelyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let odd = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte >= 32 && byte <= 126) continue;
    if (byte >= 128) continue;
    odd += 1;
  }
  return sample.length > 0 && odd / sample.length > 0.08;
}

export function readCodeFile(repoRoot, relPath, options = {}) {
  const { rel, abs, stat } = assertReadableCodeFile(repoRoot, relPath, options);
  const buffer = fs.readFileSync(abs);
  if (isLikelyBinary(buffer)) {
    throw new Error(`Binary-like file rejected: ${rel}`);
  }
  const maxChars = options.maxChars || DEFAULT_MAX_READ_CHARS;
  const text = buffer.toString('utf8');
  return {
    path: rel,
    size: stat.size,
    truncated: text.length > maxChars,
    content: text.slice(0, maxChars),
  };
}

function* walkAllowedFiles(repoRoot, options = {}) {
  const maxFiles = options.maxFiles || DEFAULT_MAX_FILES;
  let yielded = 0;
  const queue = [
    ...ALLOWED_DIRS.map((dir) => path.join(repoRoot, dir)),
    ...Array.from(ALLOWED_ROOT_FILES).map((file) => path.join(repoRoot, file)),
  ];
  while (queue.length && yielded < maxFiles) {
    const current = queue.shift();
    if (!current || !fs.existsSync(current)) continue;
    const rel = normalizeRelPath(path.relative(repoRoot, current));
    if (isDeniedPath(rel)) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        queue.push(path.join(current, entry.name));
      }
      continue;
    }
    if (!stat.isFile() || !isAllowedCodePath(rel) || !isTextFilePath(rel)) continue;
    yielded += 1;
    yield rel;
  }
}

function snippetAround(text, index, query, radius = 220) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function searchCode(repoRoot, query, options = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query is required.');
  const lowerQ = q.toLowerCase();
  const maxSnippets = options.maxSnippets || DEFAULT_MAX_SNIPPETS;
  const results = [];
  const warnings = [];

  for (const rel of walkAllowedFiles(repoRoot, options)) {
    try {
      const file = readCodeFile(repoRoot, rel, {
        maxFileBytes: options.maxFileBytes,
        maxChars: options.maxReadChars || DEFAULT_MAX_READ_CHARS,
      });
      const lower = file.content.toLowerCase();
      const lowerPath = rel.toLowerCase();
      const index = lower.indexOf(lowerQ);
      const pathMatch = lowerPath.includes(lowerQ);
      if (index === -1 && !pathMatch) continue;
      results.push({
        path: rel,
        title: path.basename(rel),
        snippet: index >= 0 ? snippetAround(file.content, index, q) : clip(file.content, 320),
        score: pathMatch ? 1.2 : 1,
        truncated: file.truncated,
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    query: q,
    mode: 'safe-keyword',
    results: results
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, maxSnippets),
    warnings: warnings.slice(0, 8),
  };
}

function extractLikelyFilesFromText(text) {
  const matches = String(text || '').match(/(?:packages|scripts|docs|\.github|\.redbyte)\/[A-Za-z0-9._/@+-]+/g) || [];
  return matches.map(normalizeRelPath);
}

function inferQuery({ task, packet, rawRequest }) {
  const text = [
    rawRequest,
    task?.title,
    task?.summary,
    task?.recommendedAction,
    task?.codexPrompt,
    packet?.title,
    packet?.summary,
    packet?.prompt,
    packet?.reply,
  ].filter(Boolean).join(' ');

  if (/export|vivado|artifact|zip/i.test(text)) return 'ExportSurface';
  if (/hardware|map pins|basys|pin/i.test(text)) return 'HardwareSurface';
  if (/verify|proof|evidence|waveform/i.test(text)) return 'VerifySurface';
  if (/design|canvas|wire|component/i.test(text)) return 'DesignSurface';
  if (/project|onboarding|starter/i.test(text)) return 'ProjectSurface';
  if (/hq|marcus|operator|packet|task|proposal/i.test(text)) return 'HqSurface';
  return clip(text, 80) || 'RedByte';
}

export function gatherCodeContext(repoRoot, { task = null, packet = null, likelyFiles = [], rawRequest = '' } = {}) {
  const explicitFiles = [
    ...likelyFiles,
    ...extractLikelyFilesFromText(JSON.stringify(task || {})),
    ...extractLikelyFilesFromText(JSON.stringify(packet || {})),
  ];

  const findings = [];
  const warnings = [];
  const seen = new Set();
  for (const file of explicitFiles) {
    const rel = normalizeRelPath(file).replace(/[).,;:]+$/g, '');
    if (seen.has(rel)) continue;
    seen.add(rel);
    try {
      const read = readCodeFile(repoRoot, rel, { maxChars: 1800 });
      findings.push({
        path: read.path,
        reason: 'Referenced by task, packet, or source metadata.',
        snippet: clip(read.content, 900),
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
    if (findings.length >= 8) break;
  }

  if (findings.length < 6) {
    const search = searchCode(repoRoot, inferQuery({ task, packet, rawRequest }), { maxSnippets: 8 });
    for (const result of search.results) {
      if (seen.has(result.path)) continue;
      seen.add(result.path);
      findings.push({
        path: result.path,
        reason: `Matched safe code search for "${search.query}".`,
        snippet: result.snippet,
      });
      if (findings.length >= 8) break;
    }
    warnings.push(...search.warnings);
  }

  return {
    query: inferQuery({ task, packet, rawRequest }),
    targetFiles: findings.map((finding) => finding.path),
    codeFindings: findings,
    warnings: warnings.slice(0, 10),
  };
}

function proposalTitle({ task, packet, rawRequest }) {
  return clip(task?.title || packet?.title || rawRequest || 'Marcus patch proposal', 140);
}

function defaultTests(targetFiles) {
  const tests = ['pnpm rb:hq:test', 'pnpm rb:doc:validate', 'pnpm rb:encoding:check', 'git diff --check'];
  if (targetFiles.some((file) => file.startsWith('packages/rb-apps/'))) {
    tests.push('pnpm --filter @redbyte/playground build');
  }
  return tests;
}

function renderProposalMarkdown(proposal) {
  return [
    '# Marcus Patch Proposal',
    '',
    `- id: ${proposal.id}`,
    `- createdAt: ${proposal.createdAt}`,
    `- applyStatus: ${proposal.applyStatus}`,
    `- requiresApproval: ${proposal.requiresApproval}`,
    '',
    '## Product Problem',
    proposal.productProblem,
    '',
    '## Target Files',
    ...proposal.targetFiles.map((file) => `- ${file}`),
    '',
    '## Code Findings',
    ...proposal.codeFindings.map((finding) => `- ${finding.path}: ${finding.reason}`),
    '',
    '## Proposed Changes',
    ...proposal.proposedChanges.map((change) => `- ${change}`),
    '',
    '## Patch Sketch',
    proposal.patchSketch,
    '',
    '## Risks',
    ...proposal.risks.map((risk) => `- ${risk}`),
    '',
    '## Do Not Touch',
    ...proposal.doNotTouch.map((item) => `- ${item}`),
    '',
    '## Tests',
    ...proposal.tests.map((test) => `- ${test}`),
    '',
    '## Codex Prompt',
    '```text',
    proposal.codexPrompt,
    '```',
    '',
  ].join('\n');
}

export function ensureProposalDir(outputDir) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
}

function writeGeneratedFile(filePath, text, outputDir) {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(outputDir);
  if (!resolved.startsWith(resolvedDir + path.sep)) {
    throw new Error(`Proposal output path escaped directory: ${resolved}`);
  }
  fs.writeFileSync(resolved, text, 'utf8');
}

export function savePatchProposal(repoRoot, proposal, outputDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq', 'patch-proposals')) {
  ensureProposalDir(outputDir);
  const id = sanitizeProposalId(proposal.id);
  const jsonPath = path.join(outputDir, `${id}.json`);
  const mdPath = path.join(outputDir, `${id}.md`);
  const generatedFiles = [
    normalizeRelPath(path.relative(repoRoot, jsonPath)),
    normalizeRelPath(path.relative(repoRoot, mdPath)),
  ];
  const finalProposal = {
    ...proposal,
    generatedFiles,
  };
  writeGeneratedFile(jsonPath, `${JSON.stringify(finalProposal, null, 2)}\n`, outputDir);
  writeGeneratedFile(mdPath, renderProposalMarkdown(finalProposal), outputDir);
  return finalProposal;
}

export function generatePatchProposal(repoRoot, { task = null, packet = null, taskId = null, packetId = null, rawRequest = '', likelyFiles = [] } = {}, outputDir) {
  const context = gatherCodeContext(repoRoot, { task, packet, likelyFiles, rawRequest });
  const id = `patch-proposal-${nowIdStamp()}-${crypto.randomBytes(3).toString('hex')}`;
  const title = proposalTitle({ task, packet, rawRequest });
  const productProblem = clip(rawRequest || task?.summary || packet?.summary || packet?.prompt || title, 900);
  const targetFiles = context.targetFiles.slice(0, 10);
  const validationCommands = defaultTests(targetFiles);
  const proposal = {
    id,
    createdAt: new Date().toISOString(),
    sourceTaskId: taskId || task?.id || null,
    sourcePacketId: packetId || packet?.id || task?.sourcePacketId || null,
    title,
    productProblem,
    targetFiles,
    codeFindings: context.codeFindings,
    proposedChanges: targetFiles.length
      ? targetFiles.map((file) => `Inspect and minimally update ${file} only if Codex confirms it directly owns the requested behavior.`)
      : ['No safe target file found yet; run a narrower code search before implementation.'],
    patchSketch: [
      'Proposal only. No patch has been applied.',
      'Codex should inspect the listed files, make the smallest bounded change, and run the listed validation commands.',
      'Do not broaden into unrelated product surfaces or agent infrastructure.',
    ].join(' '),
    risks: [
      ...context.warnings,
      'Proposal may identify likely files, not guaranteed edit targets.',
      'Generated proposal output is not canonical repo truth.',
    ].slice(0, 12),
    doNotTouch: [
      'Do not let Marcus edit files or apply patches.',
      'Do not write to Obsidian.',
      'Do not stage, commit, or push from Marcus.',
      'Do not overstate E3, Verify proof, or Trusted Export status.',
    ],
    tests: validationCommands,
    validationCommands,
    evidenceSources: [
      ...(Array.isArray(task?.sources) ? task.sources.slice(0, 8) : []),
      ...(Array.isArray(packet?.sources) ? packet.sources.slice(0, 8) : []),
      {
        id: 'marcus-code-intelligence-doc',
        kind: 'repo_doc',
        title: 'Marcus Code Intelligence',
        path: 'docs/product/RED_BYTE_MARCUS_CODE_INTELLIGENCE.md',
        excerpt: 'Patch proposals are proposal-only and require approval.',
        freshness: 'current',
        authority: 'canonical',
      },
    ],
    generatedFiles: [],
    requiresApproval: true,
    applyStatus: 'proposal_only',
    codexPrompt: [
      'You are Codex operating inside RedByte.',
      `Implement only after reviewing proposal ${id}.`,
      `Problem: ${productProblem}`,
      `Target files: ${targetFiles.join(', ') || 'none identified yet'}`,
      'Rules: Marcus proposal is not an applied patch. Preserve RedByte trust boundaries. Make the smallest implementation change and run the listed tests.',
      `Validation: ${validationCommands.join(' && ')}`,
    ].join('\n'),
  };
  return savePatchProposal(repoRoot, proposal, outputDir);
}

export function listPatchProposals(repoRoot, { limit = 20 } = {}, outputDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq', 'patch-proposals')) {
  if (!fs.existsSync(outputDir)) return [];
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  return fs.readdirSync(outputDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try {
        const proposal = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf8'));
        return {
          id: proposal.id,
          createdAt: proposal.createdAt,
          title: proposal.title,
          sourceTaskId: proposal.sourceTaskId,
          sourcePacketId: proposal.sourcePacketId,
          targetFileCount: Array.isArray(proposal.targetFiles) ? proposal.targetFiles.length : 0,
          riskCount: Array.isArray(proposal.risks) ? proposal.risks.length : 0,
          requiresApproval: proposal.requiresApproval === true,
          applyStatus: proposal.applyStatus || 'proposal_only',
          generatedFiles: Array.isArray(proposal.generatedFiles) ? proposal.generatedFiles : [],
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, safeLimit);
}

export function readPatchProposal(repoRoot, id, outputDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq', 'patch-proposals')) {
  const safeId = sanitizeProposalId(id);
  const filePath = path.join(outputDir, `${safeId}.json`);
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(outputDir);
  if (!resolved.startsWith(resolvedDir + path.sep)) {
    throw new Error(`Proposal path escaped directory: ${resolved}`);
  }
  if (!fs.existsSync(resolved)) throw new Error(`Patch proposal not found: ${safeId}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}
