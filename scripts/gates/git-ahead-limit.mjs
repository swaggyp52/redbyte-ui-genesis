#!/usr/bin/env node

import { execSync } from 'node:child_process';

const LIMIT = Number.parseInt(process.env.RB_GIT_AHEAD_LIMIT ?? '3', 10);
const BASE_REF = process.env.RB_GIT_AHEAD_BASE ?? 'origin/main';

function run(command) {
  return execSync(command, {
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

function fail(message) {
  console.error(`[git-ahead-limit] ${message}`);
  process.exit(1);
}

if (!Number.isFinite(LIMIT) || LIMIT < 0) {
  fail(`Invalid RB_GIT_AHEAD_LIMIT="${process.env.RB_GIT_AHEAD_LIMIT ?? ''}" (must be >= 0).`);
}

let statusLine = '';
try {
  statusLine = run('git status -sb').split('\n')[0] ?? '';
} catch {
  fail('Unable to read git status.');
}

let aheadCount = 0;
const aheadMatch = statusLine.match(/\[ahead (\d+)(?:, behind \d+)?\]/);
if (aheadMatch?.[1]) {
  aheadCount = Number.parseInt(aheadMatch[1], 10);
} else {
  try {
    run(`git rev-parse --verify --quiet ${BASE_REF}`);
  } catch {
    fail(`Base ref "${BASE_REF}" is unavailable. Set RB_GIT_AHEAD_BASE to a known base commit/ref.`);
  }

  try {
    const aheadRaw = run(`git rev-list --count ${BASE_REF}..HEAD`);
    aheadCount = Number.parseInt(aheadRaw, 10);
    if (!Number.isFinite(aheadCount)) {
      fail(`Unable to parse ahead count from "${aheadRaw}".`);
    }
  } catch {
    fail(`Unable to compute ahead count against "${BASE_REF}".`);
  }
}

if (aheadCount > LIMIT) {
  fail(
    `Ahead count ${aheadCount} exceeds limit ${LIMIT}. Push required. Feature work blocked.`
  );
}

console.log(`[git-ahead-limit] PASS: ahead=${aheadCount} limit=${LIMIT}`);
