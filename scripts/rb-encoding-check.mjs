#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    process.stderr.write('[rb-encoding-check] ERROR: must run inside a git repository.\n');
    process.exit(1);
  }
}

const ROOT = resolveRepoRoot();
const TARGETS = ['.github', 'docs/product', 'docs/DOC_INDEX.md', 'scripts', 'AI_STATE.md'];
const ALLOWED_EXTENSIONS = new Set(['.md', '.mjs']);
const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  '.redbyte/work',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'trace',
  'docs/archive',
]);

const EXCLUDE_FILES = new Set([
  'scripts/rb-encoding-check.mjs',
]);

const BAD_PATTERNS = [
  'â€',
  'âœ',
  'âš',
  'Â',
  'Ã',
  '�',
];

function isExcludedDir(relPath) {
  if (!relPath) return false;
  const normalized = relPath.replace(/\\/g, '/');
  for (const excluded of EXCLUDE_DIRS) {
    if (normalized === excluded || normalized.startsWith(`${excluded}/`)) {
      return true;
    }
  }
  return false;
}

function collectFiles(absPath, relPath = '') {
  if (!fs.existsSync(absPath)) return [];

  const stats = fs.statSync(absPath);
  if (stats.isFile()) {
    const ext = path.extname(absPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return [];
    if (EXCLUDE_FILES.has(relPath.replace(/\\/g, '/'))) return [];
    return [{ absPath, relPath }];
  }

  if (isExcludedDir(relPath)) return [];

  const out = [];
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextRel = relPath ? `${relPath}/${entry.name}` : entry.name;
    const nextAbs = path.join(absPath, entry.name);

    if (entry.isDirectory()) {
      if (!isExcludedDir(nextRel)) {
        out.push(...collectFiles(nextAbs, nextRel));
      }
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      if (!EXCLUDE_FILES.has(nextRel)) {
        out.push({ absPath: nextAbs, relPath: nextRel });
      }
    }
  }
  return out;
}

function findHits(content) {
  const hits = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of BAD_PATTERNS) {
      if (line.includes(pattern)) {
        hits.push({ lineNumber: i + 1, pattern, line });
      }
    }
  }
  return hits;
}

const files = [];
for (const target of TARGETS) {
  const absTarget = path.join(ROOT, target);
  const relTarget = target.replace(/\\/g, '/');
  files.push(...collectFiles(absTarget, relTarget));
}

const findings = [];
for (const file of files) {
  let content = fs.readFileSync(file.absPath, 'utf8');
  // AI_STATE prepends newest entries at the top and keeps long historical tail sections.
  // Guard the head window so current slices cannot introduce new mojibake.
  if (file.relPath === 'AI_STATE.md') {
    content = content.split(/\r?\n/).slice(0, 90).join('\n');
  }
  const hits = findHits(content);
  for (const hit of hits) {
    findings.push({ file: file.relPath, ...hit });
  }
}

if (findings.length === 0) {
  process.stdout.write('[rb-encoding-check] [ok] No mojibake markers found.\n');
  process.exit(0);
}

process.stderr.write('[rb-encoding-check] ERROR: mojibake markers found:\n');
for (const item of findings) {
  process.stderr.write(`- ${item.file}:${item.lineNumber} [${item.pattern}] ${item.line}\n`);
}
process.exit(1);
