#!/usr/bin/env node
/**
 * rb-doc-validate.mjs
 *
 * Validates that canonical docs have required frontmatter, that CLAUDE.md
 * @-imports resolve, that ACTIVE_WORK cockpit links resolve, and that
 * stale docs still carry their SUPERSEDED/HISTORICAL banners.
 *
 * Exit 0 = all checks pass   Exit 1 = one or more checks failed
 *
 * Usage: pnpm rb:doc:validate
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

// ── Canonical docs that must have doc_status: current + used_by_claude: true ──
const CANONICAL_DOCS = [
  'docs/ACTIVE_WORK.md',
  'docs/ARCHITECTURE.md',
  'docs/DOC_INDEX.md',
  'docs/STUDENT_RELEASE_READINESS.md',
  'docs/RC1_STUDENT_RELEASE_FREEZE.md',
  'docs/STUDENT_UX_LAYER.md',
  'docs/contracts/RedByte_Product_Contract.md',
  'docs/contracts/Sequential_Support_Boundary.md',
  'docs/ide/00-ide-layout.md',
  'docs/ide/01-project.md',
  'docs/ide/02-design.md',
  'docs/ide/03-verify.md',
  'docs/ide/04-export.md',
  'docs/ide/05-import.md',
  'docs/ide/SURFACE_CONFORMANCE.md',
  'docs/ide/design-system-v1.md',
  'docs/ide/style-guide.md',
  'docs/ide/ui-contract.md',
];

// ── Stale docs: must have their SUPERSEDED/HISTORICAL banner ──────────────────
const STALE_DOCS = [
  { file: 'docs/00-canon/00-project-identity.md', banner: 'SUPERSEDED' },
  { file: 'docs/00-canon/01-core-principles.md',  banner: 'ASPIRATIONAL' },
  { file: 'docs/00-canon/06-owners-manual.md',    banner: 'SUPERSEDED' },
  { file: 'docs/00-canon/07-fpga-laboratory-constitution.md', banner: 'ASPIRATIONAL' },
  { file: 'docs/00-canon/08-fpga-agent-bootstrap.md', banner: 'SUPERSEDED' },
  { file: 'docs/STUDENT_WORKFLOW.md',     banner: 'SUPERSEDED' },
  { file: 'docs/IMPLEMENTATION_STATUS.md', banner: 'SUPERSEDED' },
  { file: 'docs/PRODUCT_SURFACES.md',     banner: 'SUPERSEDED' },
  { file: 'docs/INTERACTION_CONTRACT.md', banner: 'SUPERSEDED' },
  { file: 'docs/PROJECT_MODEL.md',        banner: 'SUPERSEDED' },
];

// ── Required frontmatter fields for canonical docs ────────────────────────────
const REQUIRED_FIELDS = ['doc_status', 'last_validated', 'owner', 'used_by_claude'];

let pass = 0;
let fail = 0;
const issues = [];

function ok(label) {
  console.log(`  [ok]     ${label}`);
  pass++;
}

function bad(label, detail) {
  console.log(`  [FAIL]   ${label}`);
  if (detail) console.log(`           ${detail}`);
  fail++;
  issues.push(label);
}

function skip(label) {
  console.log(`  [skip]   ${label} (file not found)`);
}

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const result = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kv) result[kv[1].trim()] = kv[2].trim();
  }
  return result;
}

const HR = '─'.repeat(62);
console.log('\n' + HR);
console.log('  rb:doc:validate');
console.log(HR);

// ── 1. Canonical doc frontmatter ─────────────────────────────────────────────
console.log('\n  Canonical docs — frontmatter');
for (const rel of CANONICAL_DOCS) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { skip(rel); continue; }
  const fm = parseFrontmatter(fs.readFileSync(full, 'utf8'));
  const missing = REQUIRED_FIELDS.filter(f => !fm[f]);
  if (missing.length > 0) {
    bad(rel, `missing: ${missing.join(', ')}`);
  } else if (fm.doc_status !== 'current') {
    bad(rel, `doc_status = "${fm.doc_status}" (expected "current")`);
  } else if (fm.used_by_claude !== 'true') {
    bad(rel, `used_by_claude = "${fm.used_by_claude}" (expected "true")`);
  } else {
    ok(rel);
  }
}

// ── 2. Stale doc banners ──────────────────────────────────────────────────────
console.log('\n  Stale docs — SUPERSEDED/HISTORICAL banners');
for (const { file, banner } of STALE_DOCS) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { skip(file); continue; }
  const first300 = fs.readFileSync(full, 'utf8').slice(0, 300);
  if (first300.includes(banner)) {
    ok(file);
  } else {
    bad(file, `expected "${banner}" banner in first 300 chars`);
  }
}

// ── 3. CLAUDE.md @-imports resolve ───────────────────────────────────────────
console.log('\n  CLAUDE.md @-imports');
const claudeMd = path.join(ROOT, 'CLAUDE.md');
if (fs.existsSync(claudeMd)) {
  const content = fs.readFileSync(claudeMd, 'utf8');
  const imports = [...content.matchAll(/^@([\w./\-]+\.md)/gm)].map(m => m[1]);
  if (imports.length === 0) {
    console.log('  [info]   no @-imports found in CLAUDE.md');
  }
  for (const imp of imports) {
    const full = path.join(ROOT, imp);
    if (fs.existsSync(full)) {
      ok(`@${imp}`);
    } else {
      bad(`@${imp}`, 'file does not exist');
    }
  }
} else {
  bad('CLAUDE.md', 'not found at repo root');
}

// ── 4. ACTIVE_WORK cockpit links resolve ──────────────────────────────────────
console.log('\n  ACTIVE_WORK.md cockpit links');
const awPath = path.join(ROOT, 'docs', 'ACTIVE_WORK.md');
if (fs.existsSync(awPath)) {
  const content = fs.readFileSync(awPath, 'utf8');
  // Extract markdown links: [text](./path) or [text](path)
  const links = [...content.matchAll(/\[.*?\]\((\.\/|\.\.\/)?([^)#\s]+\.md)[^)]*\)/g)]
    .map(m => m[2])
    .filter(p => !p.startsWith('http'));

  const checked = new Set();
  for (const rel of links) {
    if (checked.has(rel)) continue;
    checked.add(rel);
    // Resolve relative to docs/
    const full = path.isAbsolute(rel)
      ? path.join(ROOT, rel)
      : path.join(ROOT, 'docs', rel);
    if (fs.existsSync(full)) {
      ok(rel);
    } else {
      bad(rel, `linked from ACTIVE_WORK.md — file not found at ${full}`);
    }
  }
} else {
  bad('docs/ACTIVE_WORK.md', 'not found');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + HR);
console.log(`  Results: ${pass} passed, ${fail} failed`);
if (fail === 0) {
  console.log('  Status: ALL VALID');
} else {
  console.log('  Status: ISSUES FOUND');
  console.log('\n  Failed checks:');
  for (const i of issues) console.log(`    - ${i}`);
}
console.log(HR + '\n');

process.exit(fail > 0 ? 1 : 0);
