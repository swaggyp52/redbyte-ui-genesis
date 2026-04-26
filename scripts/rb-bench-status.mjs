#!/usr/bin/env node
/**
 * rb-bench-status.mjs
 *
 * Summarizes Vivado / hardware certification state from the matrix doc
 * and any logs present under out/vivado-cert/.
 *
 * Usage: pnpm rb:bench:status
 */

import fs from 'fs';
import path from 'path';

const ROOT   = process.cwd();
const MATRIX = path.join(ROOT, 'docs', 'release', 'vivado-basys3-certification-matrix.md');
const CERTS  = path.join(ROOT, 'out', 'vivado-cert');

function tableRows(text, headerPattern) {
  return text.split('\n')
    .filter(l => l.startsWith('|') && !l.includes('---') && !l.match(headerPattern))
    .map(l => l.split('|').filter(Boolean).map(c => c.trim()))
    .filter(cols => cols.length >= 4);
}

function certLogs() {
  if (!fs.existsSync(CERTS)) return [];
  return fs.readdirSync(CERTS)
    .filter(f => f.endsWith('.log'))
    .map(f => {
      const stat = fs.statSync(path.join(CERTS, f));
      return { name: f, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function lastLine(logFile) {
  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim()).slice(-5);
    return lines[lines.length - 1] || '';
  } catch {
    return '';
  }
}

const HR = '─'.repeat(62);
console.log('\n' + HR);
console.log('  RedByte — Vivado / Hardware Bench Status');
console.log(HR);

// ── Certification matrix rows ─────────────────────────────────────────────────
if (fs.existsSync(MATRIX)) {
  const content = fs.readFileSync(MATRIX, 'utf8');

  // Find the student-critical matrix table
  const tableStart = content.indexOf('## Student-critical matrix');
  const tableEnd   = content.indexOf('\n---', tableStart);
  const tableText  = tableStart !== -1 ? content.slice(tableStart, tableEnd !== -1 ? tableEnd : undefined) : content;

  const rows = tableRows(tableText, /Project.*Category|---/);

  console.log('\n  CERTIFICATION MATRIX');
  console.log(`  ${'Project/fixture'.padEnd(42)} L0  E0  E1  E2  E3`);
  console.log('  ' + '─'.repeat(60));

  for (const cols of rows) {
    if (cols.length < 5) continue;
    const name = cols[0].slice(0, 40).padEnd(42);
    const l0 = cols[2]?.startsWith('yes') ? 'yes' : cols[2]?.slice(0, 3) || '—';
    const e0 = cols[3]?.startsWith('yes') ? 'yes' : cols[3]?.slice(0, 3) || '—';
    const e1 = cols[4]?.startsWith('**yes') ? ' ✓ ' : cols[4]?.slice(0, 3) || ' — ';
    const e2 = cols[5]?.startsWith('**yes') ? ' ✓ ' : cols[5]?.slice(0, 3) || ' — ';
    const e3 = cols[6]?.startsWith('**yes') ? ' ✓ ' : cols[6]?.slice(0, 3) || ' — ';
    console.log(`  ${name} ${l0.slice(0,3).padEnd(4)} ${e0.slice(0,3).padEnd(4)} ${e1.slice(0,3).padEnd(4)} ${e2.slice(0,3).padEnd(4)} ${e3.slice(0,3)}`);
  }
  console.log('');
  console.log('  Full matrix: docs/release/vivado-basys3-certification-matrix.md');
} else {
  console.log('\n  [skip] docs/release/vivado-basys3-certification-matrix.md not found');
}

// ── Recent log files ──────────────────────────────────────────────────────────
const logs = certLogs();
if (logs.length > 0) {
  console.log('\n  RECENT VIVADO LOGS  (out/vivado-cert/)');
  for (const { name, mtime } of logs.slice(0, 8)) {
    const age  = mtime.toISOString().slice(0, 10);
    const tail = lastLine(path.join(CERTS, name));
    const status = tail.includes('SUCCESS') || tail.includes('write_bitstream Complete') ? '[ok]   '
                 : tail.includes('ERROR')   || tail.includes('FAIL')                    ? '[FAIL] '
                 : '       ';
    console.log(`  ${status}${age}  ${name}`);
    if (tail) console.log(`         └─ ${tail.slice(0, 80)}`);
  }
} else {
  console.log('\n  [info] No logs in out/vivado-cert/ — run Vivado cert scripts to populate');
}

// ── Next bench task from ACTIVE_WORK ──────────────────────────────────────────
const awPath = path.join(ROOT, 'docs', 'ACTIVE_WORK.md');
if (fs.existsSync(awPath)) {
  const content = fs.readFileSync(awPath, 'utf8');
  const m = content.match(/## Next bench \/ Vivado task\n([\s\S]*?)(?=\n## )/);
  if (m) {
    const target = m[1].trim().split('\n').find(l => l.startsWith('**Target:**'));
    if (target) {
      console.log('\n  NEXT BENCH TARGET');
      console.log(`  ${target.replace(/\*\*/g, '')}`);
      console.log('  Full task: docs/ACTIVE_WORK.md — "Next bench / Vivado task"');
    }
  }
}

console.log('\n' + HR + '\n');
