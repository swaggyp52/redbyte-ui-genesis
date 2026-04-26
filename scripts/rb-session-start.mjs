#!/usr/bin/env node
/**
 * rb-session-start.mjs
 *
 * Creates today's session note from the template (if not already present),
 * then prints a startup brief: branch, commit, top priority, blocker, bench target.
 *
 * Usage: pnpm rb:session:start
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ACTIVE_WORK = path.join(ROOT, 'docs', 'ACTIVE_WORK.md');
const TEMPLATE = path.join(ROOT, '01 Dashboard', 'Session Template.md');
const INBOX = path.join(ROOT, '00 Inbox');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/** Extract content between two ## headings. */
function section(content, heading) {
  const re = new RegExp(`## ${escRe(heading)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstListItem(text) {
  const line = text.split('\n').find(l => /^\d+\./.test(l));
  return line ? line.replace(/^\d+\.\s+\*\*(.+?)\*\*.*/, '$1').replace(/^\d+\.\s+/, '').split(' — ')[0].trim() : 'none';
}

function firstTableRow(text) {
  const rows = text.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('| Blocker') && !l.includes('| Evidence') && !l.includes('| Status'));
  if (!rows[0]) return '';
  const cols = rows[0].split('|').filter(Boolean).map(s => s.trim());
  return cols.slice(0, 2).join(': ');
}

function benchTarget(text) {
  const line = text.split('\n').find(l => l.startsWith('**Target:**'));
  return line ? line.replace('**Target:**', '').trim() : '';
}

// ── Read ACTIVE_WORK ──────────────────────────────────────────────────────────
if (!fs.existsSync(ACTIVE_WORK)) {
  console.error('[error] docs/ACTIVE_WORK.md not found — run from repo root');
  process.exit(1);
}
const aw = fs.readFileSync(ACTIVE_WORK, 'utf8');
const topPriority = firstListItem(section(aw, 'Top 3 priorities'));
const blocker     = firstTableRow(section(aw, 'Blocked')) || 'none';
const bench       = benchTarget(section(aw, 'Next bench / Vivado task'));
const proof       = firstTableRow(section(aw, 'Latest proof / evidence'));

// ── Git state ─────────────────────────────────────────────────────────────────
const branch     = git('rev-parse --abbrev-ref HEAD');
const lastCommit = git('log --oneline -1');
const tracking   = git('status --branch --short').split('\n')[0].replace(/^## /, '');

// ── Create session note ───────────────────────────────────────────────────────
const date = today();
const sessionFile = path.join(INBOX, `Session-${date}.md`);

if (!fs.existsSync(sessionFile)) {
  if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });

  let content;
  if (fs.existsSync(TEMPLATE)) {
    content = fs.readFileSync(TEMPLATE, 'utf8')
      .replace(/YYYY-MM-DD/g, date)
      .replace(/^top_priority: ""$/m, `top_priority: "${topPriority.replace(/"/g, "'")}"`)
      .replace(/^current_blocker: ""$/m, `current_blocker: "${blocker.replace(/"/g, "'")}"`);
  } else {
    content = [
      '---',
      `type: session`,
      `date: ${date}`,
      `top_priority: "${topPriority}"`,
      `current_blocker: "${blocker}"`,
      '---',
      '',
      `# Session — ${date}`,
      '',
      `## Top priority`,
      topPriority,
      '',
      `## Current blocker`,
      blocker,
      '',
      `## Session log`,
      '',
      `## End of session`,
      '**What changed:**',
      '**What is true now:**',
      '**What failed / is still open:**',
      '**Exact next action:**',
    ].join('\n');
  }
  fs.writeFileSync(sessionFile, content, 'utf8');
  console.log(`[created] 00 Inbox/Session-${date}.md`);
} else {
  console.log(`[exists]  00 Inbox/Session-${date}.md`);
}

// ── Startup brief ─────────────────────────────────────────────────────────────
const HR = '─'.repeat(62);
console.log('\n' + HR);
console.log(`  RedByte  —  Session Start  —  ${date}`);
console.log(HR);
console.log(`  Branch       ${branch}`);
console.log(`  Last commit  ${lastCommit}`);
console.log(`  Git          ${tracking}`);
console.log('');
console.log(`  Priority 1   ${topPriority}`);
console.log(`  Blocker      ${blocker}`);
if (bench)  console.log(`  Bench →      ${bench}`);
if (proof)  console.log(`  Last proof   ${proof}`);
console.log('');
console.log(`  Session note 00 Inbox/Session-${date}.md`);
console.log(`  Cockpit      docs/ACTIVE_WORK.md`);
console.log(HR + '\n');
