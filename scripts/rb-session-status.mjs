#!/usr/bin/env node
/**
 * rb-session-status.mjs
 *
 * Mid-session status check: repo state, top priorities, blockers,
 * latest proof links, and optional gate/bench summary.
 *
 * Flags:
 *   --gates    Run pnpm verify:gates (slow — includes full build)
 *
 * Usage: pnpm rb:session:status [--gates]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ACTIVE_WORK = path.join(ROOT, 'docs', 'ACTIVE_WORK.md');
const RUN_GATES = process.argv.includes('--gates');

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function section(content, heading) {
  const re = new RegExp(`## ${escRe(heading)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

function stripMd(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
}

function listItems(text) {
  return text.split('\n')
    .filter(l => /^\d+\./.test(l))
    .map(l => stripMd(l.replace(/^\d+\.\s+/, '').split(' — ')[0]));
}

function tableRows(text, skipHeaders = []) {
  return text.split('\n')
    .filter(l => {
      if (!l.startsWith('|')) return false;
      if (l.includes('---')) return false;
      for (const h of skipHeaders) if (l.includes(`| ${h}`)) return false;
      return true;
    })
    .map(l => l.split('|').filter(Boolean).map(c => c.trim()));
}

function bench(text) {
  const target = text.split('\n').find(l => l.startsWith('**Target:**'));
  const e3 = text.split('\n').find(l => l.startsWith('E3'));
  const lines = [target, e3].filter(Boolean).map(l => '  ' + l.replace(/\*\*/g, ''));
  return lines.join('\n');
}

// ── Read ACTIVE_WORK ──────────────────────────────────────────────────────────
if (!fs.existsSync(ACTIVE_WORK)) {
  console.error('[error] docs/ACTIVE_WORK.md not found');
  process.exit(1);
}
const aw = fs.readFileSync(ACTIVE_WORK, 'utf8');

// ── Git ───────────────────────────────────────────────────────────────────────
const branch     = git('rev-parse --abbrev-ref HEAD');
const lastCommit = git('log --oneline -1');
const tracking   = git('status --branch --short').split('\n')[0].replace(/^## /, '');
const dirty      = git('status --short').split('\n').filter(l => l.trim()).length;

// ── Gate check (optional) ─────────────────────────────────────────────────────
let gateResult = null;
if (RUN_GATES) {
  console.log('[running] pnpm verify:gates — this will take a while...\n');
  try {
    execSync('pnpm verify:gates', { cwd: ROOT, stdio: 'inherit' });
    gateResult = 'PASS';
  } catch {
    gateResult = 'FAIL';
  }
}

// ── Print ─────────────────────────────────────────────────────────────────────
const HR = '─'.repeat(62);
const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
console.log('\n' + HR);
console.log(`  RedByte Session Status  —  ${now}`);
console.log(HR);

console.log('\n  GIT');
console.log(`    Branch       ${branch}`);
console.log(`    Last commit  ${lastCommit}`);
console.log(`    Tracking     ${tracking}`);
console.log(`    Dirty files  ${dirty === 0 ? 'clean' : dirty}`);

if (gateResult) {
  console.log(`\n  GATES  ${gateResult}`);
}

console.log('\n  TOP PRIORITIES');
for (const item of listItems(section(aw, 'Top 3 priorities'))) {
  console.log(`    • ${item}`);
}

console.log('\n  BLOCKED');
const blockedRows = tableRows(section(aw, 'Blocked'), ['Blocker']);
if (blockedRows.length === 0) {
  console.log('    none');
} else {
  for (const row of blockedRows) {
    console.log(`    • ${row[0]} — ${row[2] || row[1] || ''}`);
  }
}

console.log('\n  LATEST PROOF');
const proofRows = tableRows(section(aw, 'Latest proof / evidence'), ['Evidence']);
for (const row of proofRows.slice(0, 4)) {
  console.log(`    ${row[0]}: ${row[1] || ''}`);
}

const benchText = bench(section(aw, 'Next bench / Vivado task'));
if (benchText) {
  console.log('\n  NEXT BENCH TASK');
  console.log(benchText);
}

console.log('\n  COCKPIT  docs/ACTIVE_WORK.md');
console.log(HR + '\n');
