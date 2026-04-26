#!/usr/bin/env node
/**
 * rb-hooks/stop-reminder.mjs
 * Stop hook — non-blocking reminder to record the session handoff.
 *
 * If today's date already has an entry in the Session Log, stays silent.
 * If not, surfaces a systemMessage asking Claude to prompt the handoff.
 *
 * Output: JSON { systemMessage? }   Exit: always 0 (non-blocking)
 */

import fs from 'fs';
import path from 'path';

let stdinData = '';
process.stdin.on('data', d => { stdinData += d; });
process.stdin.on('end', main);

function main() {
  const ROOT        = process.cwd();
  const SESSION_LOG = path.join(ROOT, '08 Agents + Prompts', 'Session Log.md');

  const today = new Date().toISOString().slice(0, 10);

  // If today already has a log entry, stay quiet
  if (fs.existsSync(SESSION_LOG)) {
    const log = fs.readFileSync(SESSION_LOG, 'utf8');
    if (log.includes(`## ${today}`)) {
      process.stdout.write(JSON.stringify({}));
      return;
    }
  }

  // No entry today — remind
  const msg = [
    `⚠ No session handoff logged for ${today}.`,
    'Before stopping, run: pnpm rb:session:close',
    'Or paste the end-of-session block into 08 Agents + Prompts/Session Log.md manually.',
    'Fields: what changed · what is true now · what failed · exact next action',
  ].join('\n');

  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}
