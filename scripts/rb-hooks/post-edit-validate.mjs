#!/usr/bin/env node
/**
 * rb-hooks/post-edit-validate.mjs
 * PostToolUse hook (Write | Edit) — lightweight doc integrity guard.
 *
 * After any Write or Edit:
 *   1. If the file is a canonical doc: confirm required frontmatter is present.
 *   2. If the file is CLAUDE.md: confirm @-imports resolve.
 *   3. If the file is a stale doc: confirm the SUPERSEDED/HISTORICAL banner survived.
 *
 * Output: JSON { systemMessage? }   Exit: always 0 (non-blocking warning)
 */

import fs from 'fs';
import path from 'path';

const REQUIRED_FRONTMATTER = ['doc_status', 'last_validated', 'owner', 'used_by_claude'];

const CANONICAL = new Set([
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
]);

const STALE = new Map([
  ['docs/00-canon/00-project-identity.md',           'SUPERSEDED'],
  ['docs/00-canon/01-core-principles.md',            'ASPIRATIONAL'],
  ['docs/00-canon/06-owners-manual.md',              'SUPERSEDED'],
  ['docs/00-canon/07-fpga-laboratory-constitution.md','ASPIRATIONAL'],
  ['docs/00-canon/08-fpga-agent-bootstrap.md',       'SUPERSEDED'],
  ['docs/STUDENT_WORKFLOW.md',                       'SUPERSEDED'],
  ['docs/IMPLEMENTATION_STATUS.md',                  'SUPERSEDED'],
  ['docs/PRODUCT_SURFACES.md',                       'SUPERSEDED'],
  ['docs/INTERACTION_CONTRACT.md',                   'SUPERSEDED'],
  ['docs/PROJECT_MODEL.md',                          'SUPERSEDED'],
]);

let stdinData = '';
process.stdin.on('data', d => { stdinData += d; });
process.stdin.on('end', main);

function main() {
  const ROOT = process.cwd();
  const warnings = [];

  let input = {};
  try { input = JSON.parse(stdinData); } catch { /* non-fatal */ }

  // Extract the edited file path from tool_input
  const rawPath = input?.tool_input?.file_path ?? '';
  if (!rawPath) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  // Normalise to a repo-relative forward-slash path for map lookups
  const abs = path.isAbsolute(rawPath) ? rawPath : path.join(ROOT, rawPath);
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');

  // ── 1. Canonical doc frontmatter check ───────────────────────────────────
  if (CANONICAL.has(rel)) {
    if (!fs.existsSync(abs)) {
      warnings.push(`[doc-validate] ${rel}: file not found after write`);
    } else {
      const content = fs.readFileSync(abs, 'utf8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const fm = {};
      if (fmMatch) {
        for (const line of fmMatch[1].split('\n')) {
          const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
          if (kv) fm[kv[1].trim()] = kv[2].trim();
        }
      }
      const missing = REQUIRED_FRONTMATTER.filter(f => !fm[f]);
      if (missing.length) {
        warnings.push(`[doc-validate] ${rel}: missing frontmatter fields: ${missing.join(', ')}`);
      } else if (fm.doc_status !== 'current') {
        warnings.push(`[doc-validate] ${rel}: doc_status = "${fm.doc_status}" (should be "current")`);
      }
    }
  }

  // ── 2. CLAUDE.md @-import check ──────────────────────────────────────────
  if (rel === 'CLAUDE.md') {
    const content = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    const imports = [...content.matchAll(/^@([\w./\-]+\.md)/gm)].map(m => m[1]);
    for (const imp of imports) {
      if (!fs.existsSync(path.join(ROOT, imp))) {
        warnings.push(`[doc-validate] CLAUDE.md: @${imp} does not resolve`);
      }
    }
  }

  // ── 3. Stale doc banner check ────────────────────────────────────────────
  if (STALE.has(rel)) {
    const banner = STALE.get(rel);
    const content = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').slice(0, 400) : '';
    if (!content.includes(banner)) {
      warnings.push(`[doc-validate] ${rel}: "${banner}" banner was removed — stale docs must keep their banners`);
    }
  }

  if (warnings.length === 0) {
    process.stdout.write(JSON.stringify({}));
  } else {
    process.stdout.write(JSON.stringify({ systemMessage: warnings.join('\n') }));
  }
}
