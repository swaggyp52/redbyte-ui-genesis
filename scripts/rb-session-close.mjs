#!/usr/bin/env node
/**
 * rb-session-close.mjs
 *
 * Closes the session: prompts for handoff fields, prepends a new entry to
 * 08 Agents + Prompts/Session Log.md, and updates ACTIVE_WORK.md in-flight table.
 *
 * Usage: pnpm rb:session:close
 *
 * Flags:
 *   --dry-run   Print the generated entry without writing files
 */

import readline from 'readline';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT       = process.cwd();
const SESSION_LOG = path.join(ROOT, '08 Agents + Prompts', 'Session Log.md');
const ACTIVE_WORK = path.join(ROOT, 'docs', 'ACTIVE_WORK.md');
const DRY_RUN     = process.argv.includes('--dry-run');

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

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function section(content, heading) {
  const re = new RegExp(`## ${escRe(heading)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

// ── Check required files ──────────────────────────────────────────────────────
if (!fs.existsSync(SESSION_LOG)) {
  console.error('[error] 08 Agents + Prompts/Session Log.md not found');
  process.exit(1);
}

// ── Count existing entries (keep ≤ 5) ─────────────────────────────────────────
function countEntries(logContent) {
  return (logContent.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length;
}

// ── Build entry from last commit info if available ───────────────────────────
const lastCommit = git('log --oneline -1');
const branch     = git('rev-parse --abbrev-ref HEAD');

// ── Interactive prompts ───────────────────────────────────────────────────────
const HR = '─'.repeat(62);
console.log('\n' + HR);
console.log('  RedByte Session Close');
console.log('  Fill in the handoff. Press Enter to skip optional fields.');
console.log(HR + '\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function run() {
  const date     = today();
  const summary  = await ask(rl, '  Summary (one line):              ');
  const changed  = await ask(rl, '  What changed:                    ');
  const trueNow  = await ask(rl, '  What is true now:                ');
  const failed   = await ask(rl, '  What failed / still open:        ');
  const nextAct  = await ask(rl, '  Exact next action:               ');
  const proof    = await ask(rl, '  Proof / log path (optional):     ');
  const docsUpd  = await ask(rl, '  Docs updated (optional):         ');
  rl.close();

  // ── Format entry ─────────────────────────────────────────────────────────
  const lines = [
    `## ${date} — ${summary.trim() || 'session close'}`,
    '',
    `**What changed:** ${changed.trim() || '—'}`,
    '',
    `**What is true now:** ${trueNow.trim() || '—'}`,
    '',
    `**What failed / is still open:** ${failed.trim() || '—'}`,
    '',
    `**Exact next action:** ${nextAct.trim() || '—'}`,
  ];
  if (proof.trim())   lines.push('', `**Proof / log:** ${proof.trim()}`);
  if (docsUpd.trim()) lines.push('', `**Docs updated:** ${docsUpd.trim()}`);
  lines.push('');

  const entry = lines.join('\n');

  console.log('\n' + HR);
  console.log('  Generated entry:');
  console.log(HR);
  console.log(entry);

  if (DRY_RUN) {
    console.log('[dry-run] No files written.\n');
    return;
  }

  // ── Prepend to Session Log ────────────────────────────────────────────────
  let logContent = fs.readFileSync(SESSION_LOG, 'utf8');

  // Trim to 4 existing entries before adding the new one (keep ≤ 5 total)
  const existingCount = countEntries(logContent);
  if (existingCount >= 5) {
    // Remove the last (oldest) entry
    const lastMatch = [...logContent.matchAll(/^## \d{4}-\d{2}-\d{2}/gm)];
    if (lastMatch.length >= 5) {
      const cutPoint = lastMatch[lastMatch.length - 1].index;
      logContent = logContent.slice(0, cutPoint).trimEnd() + '\n';
    }
  }

  // Insert after the first ---
  const insertAfter = logContent.indexOf('\n---\n');
  if (insertAfter === -1) {
    logContent += '\n---\n\n' + entry;
  } else {
    logContent = logContent.slice(0, insertAfter + 5) + '\n' + entry + logContent.slice(insertAfter + 5);
  }

  // Bump `updated:` frontmatter field
  logContent = logContent.replace(/^updated: .+$/m, `updated: ${date}`);

  fs.writeFileSync(SESSION_LOG, logContent, 'utf8');
  console.log('[written] 08 Agents + Prompts/Session Log.md');

  // ── Update ACTIVE_WORK.md last_validated ─────────────────────────────────
  if (fs.existsSync(ACTIVE_WORK)) {
    let aw = fs.readFileSync(ACTIVE_WORK, 'utf8');
    aw = aw.replace(/^last_validated: .+$/m, `last_validated: ${date}`);
    fs.writeFileSync(ACTIVE_WORK, aw, 'utf8');
    console.log('[updated] docs/ACTIVE_WORK.md — last_validated bumped');
  }

  // ── Remind about ACTIVE_WORK in-flight update ─────────────────────────────
  console.log('\n  Remember to update docs/ACTIVE_WORK.md:');
  console.log('    • Top 3 priorities (reorder if needed)');
  console.log('    • In-flight work table (add today\'s batch, drop oldest)');
  console.log('    • Latest proof if new evidence was generated');
  console.log(HR + '\n');

  // ── Stage changed files ───────────────────────────────────────────────────
  try {
    execSync(`git add "${SESSION_LOG}" "${ACTIVE_WORK}"`, { cwd: ROOT, stdio: 'pipe' });
    console.log('[staged]  Session Log + ACTIVE_WORK.md');
  } catch {
    // non-fatal
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
