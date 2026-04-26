#!/usr/bin/env node
/**
 * rb-hooks/session-start.mjs
 * SessionStart hook — injects the RedByte session brief into Claude's context.
 *
 * Reads docs/ACTIVE_WORK.md + the last Session Log entry and outputs them
 * as `additionalContext` so every session starts with current state loaded.
 *
 * Output: JSON { hookSpecificOutput: { hookEventName, additionalContext } }
 */

import fs from 'fs';
import path from 'path';

// Consume stdin (required by hook protocol even if unused)
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', main);

function main() {
  const ROOT = process.cwd();
  const ACTIVE_WORK  = path.join(ROOT, 'docs', 'ACTIVE_WORK.md');
  const SESSION_LOG  = path.join(ROOT, '08 Agents + Prompts', 'Session Log.md');

  const lines = [];

  lines.push('══ RedByte Session Brief ══════════════════════════════════════');

  // ── Last session log entry ────────────────────────────────────────────────
  if (fs.existsSync(SESSION_LOG)) {
    const log = fs.readFileSync(SESSION_LOG, 'utf8');
    // Find the first ## YYYY-MM-DD entry
    const entryMatch = log.match(/## (\d{4}-\d{2}-\d{2}[^\n]*)\n([\s\S]*?)(?=\n## \d{4}|$)/);
    if (entryMatch) {
      lines.push(`Last handoff (${entryMatch[1].trim()}):`);
      const entryBody = entryMatch[2];
      const fields = [
        ['What changed',          /\*\*What changed:\*\*\s*(.+)/],
        ['What is true now',      /\*\*What is true now:\*\*\s*(.+)/],
        ['Still open',            /\*\*What (?:failed|is still open)[^:]*:\*\*\s*(.+)/],
        ['Exact next action',     /\*\*Exact next action:\*\*\s*(.+)/],
      ];
      for (const [label, re] of fields) {
        const m = entryBody.match(re);
        if (m) lines.push(`  ${label.padEnd(18)} ${m[1].trim()}`);
      }
    }
  }

  // ── Current state from ACTIVE_WORK ───────────────────────────────────────
  if (fs.existsSync(ACTIVE_WORK)) {
    const aw = fs.readFileSync(ACTIVE_WORK, 'utf8');

    lines.push('');

    // Top priority
    const p1 = aw.match(/## Top 3 priorities[\s\S]*?\n1\.\s+\*\*(.+?)\*\*/);
    if (p1) lines.push(`Priority 1: ${p1[1].trim()}`);

    // First blocker — find section, then first data row
    const blockerSection = aw.match(/## Blocked\s*\n([\s\S]*?)(?=\n## )/);
    if (blockerSection) {
      const dataRow = blockerSection[1].split('\n').find(
        l => l.startsWith('|') && !l.includes('---') && !l.includes('| Blocker')
      );
      if (dataRow) {
        const cols = dataRow.split('|').filter(Boolean).map(s => s.trim());
        if (cols[0]) lines.push(`Blocker:    ${cols[0]}`);
      }
    }

    // Bench target
    const bench = aw.match(/\*\*Target:\*\*\s*(.+)/);
    if (bench) lines.push(`Bench →     ${bench[1].trim()}`);
  }

  lines.push('');
  lines.push('Cockpit: docs/ACTIVE_WORK.md  |  Log: 08 Agents + Prompts/Session Log.md');
  lines.push('══════════════════════════════════════════════════════════════');

  const context = lines.join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));
}
