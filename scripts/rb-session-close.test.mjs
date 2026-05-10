#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ALLOWED_GIT_COMMANDS,
  CLOSEOUT_SCHEMA,
  buildCloseoutReport,
  ensurePathInsideSessionDir,
  parseCommand,
  writeCloseoutFiles,
} from './rb-session-close.mjs';

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => process.stdout.write(`[ok] ${name}\n`))
    .catch((error) => {
      process.stderr.write(`[fail] ${name}\n`);
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-session-close-'));
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'product'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'release'), { recursive: true });
  fs.mkdirSync(path.join(root, '.redbyte', 'agent', 'runs'), { recursive: true });

  fs.writeFileSync(path.join(root, 'AI_STATE.md'), '# AI State\n\n## Change Log\n\n- Marcus sync reliability update\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'docs', 'ACTIVE_WORK.md'),
    [
      '# Active Work',
      '',
      '## Blocked',
      '',
      '| Blocker | Why | Unblock by |',
      '|---|---|---|',
      '| Final E3 notes | Requires manual board observation | Record behavior |',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'product', 'RED_BYTE_CURRENT_TRUTH.md'),
    [
      '# Current Truth',
      '',
      '## Current product thesis',
      '- RedByte is a deterministic FPGA educational IDE.',
      '',
      '## Current UX spine',
      '- Project -> Design -> Verify -> Map Pins / Hardware -> Export',
      '',
      '## Current live blockers',
      '- E3 manual board observation still required.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'product', 'RED_BYTE_WORK_QUEUE.md'),
    [
      '# Work Queue',
      '',
      '| # | Slice | Why |',
      '|---|---|---|',
      '| 1 | Reconcile dirty tree | Prevent mixed commits |',
      '| 2 | Finish proof closure | Keep release claims honest |',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'product', 'RED_BYTE_AGENT_CONTROL_LOOP.md'),
    '# Control Loop\n\nUse control-next before product work.\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'release', 'vivado-basys3-certification-matrix.md'),
    '- E2 does not imply E3.\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'STUDENT_RELEASE_READINESS.md'),
    '- Keep proof levels honest.\n',
    'utf8',
  );

  fs.writeFileSync(
    path.join(root, '.redbyte', 'agent', 'runs', 'control-next-latest.json'),
    JSON.stringify({
      recommended_next_product_slice: 'Finish proof closure',
      why_this_task_matters: 'Main blocker on evidence posture.',
    }),
    'utf8',
  );

  fs.writeFileSync(path.join(root, 'dirty.txt'), 'dirty file\n', 'utf8');

  return root;
}

function fakeGitRunner(rootDir, overrides = {}) {
  const defaults = {
    'rev-parse --abbrev-ref HEAD': 'main',
    'rev-parse --short=12 HEAD': 'abc123def456',
    'log --oneline -1': 'abc123def456 test commit',
    'status --short': ' M dirty.txt\n?? .codex/',
  };
  const map = { ...defaults, ...overrides };
  return (cwd, commandString) => {
    assert.equal(cwd, rootDir);
    if (!(commandString in map)) {
      throw new Error(`unexpected git command: ${commandString}`);
    }
    return map[commandString];
  };
}

function unreachableFetch() {
  throw new Error('unreachable');
}

test('closeout report shape and dirty status are represented', async () => {
  const root = makeTempRepo();
  const report = await buildCloseoutReport({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    token: '',
    fetchImpl: unreachableFetch,
    gitRunner: fakeGitRunner(root),
  });

  assert.equal(report.schema, CLOSEOUT_SCHEMA);
  assert.equal(report.repo.branch, 'main');
  assert.equal(report.repo.dirty, true);
  assert.deepEqual(report.repo.status_short, [' M dirty.txt', '?? .codex/']);
  assert.equal(report.packet.generated, true);
  assert.equal(report.marcus.token_present, false);
  assert.equal(report.marcus.error, 'Marcus sync skipped: missing token.');
  assert.ok(Array.isArray(report.next_work));
  assert.ok(Array.isArray(report.blocked_work));
});

test('token detection does not reveal token and missing token skips sync', async () => {
  const root = makeTempRepo();
  const secret = 'should-not-leak';
  const report = await buildCloseoutReport({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    token: secret,
    fetchImpl: unreachableFetch,
    gitRunner: fakeGitRunner(root),
  });

  assert.equal(report.marcus.token_present, true);
  assert.equal(report.marcus.sync_attempted, false);
  assert.match(report.marcus.error || '', /unreachable/i);
  assert.ok(!JSON.stringify(report).includes(secret));
});

test('unreachable Marcus produces degraded mode while still generating local report', async () => {
  const root = makeTempRepo();
  const report = await buildCloseoutReport({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    token: 'present-token',
    fetchImpl: unreachableFetch,
    gitRunner: fakeGitRunner(root),
  });

  const files = writeCloseoutFiles(root, report);
  assert.ok(files.jsonPath.endsWith(path.join('.redbyte', 'session', 'latest-closeout.json')));
  assert.ok(files.markdownPath.endsWith(path.join('.redbyte', 'session', 'latest-closeout.md')));
  assert.equal(report.packet.generated, true);
  assert.equal(report.marcus.sync_succeeded, false);
  assert.match(report.marcus.error || '', /unreachable/i);
});

test('report writes only under .redbyte/session', () => {
  const root = makeTempRepo();
  const allowedPath = path.join(root, '.redbyte', 'session', 'latest-closeout.json');
  ensurePathInsideSessionDir(root, allowedPath);

  assert.throws(
    () => ensurePathInsideSessionDir(root, path.join(root, 'outside.json')),
    /Refusing to write outside/,
  );
});

test('closeout does not require network for local report generation', async () => {
  const root = makeTempRepo();
  const report = await buildCloseoutReport({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    token: '',
    fetchImpl: unreachableFetch,
    gitRunner: fakeGitRunner(root),
  });

  assert.equal(report.packet.generated, true);
  assert.equal(report.marcus.sync_attempted, false);
  assert.equal(report.marcus.error, 'Marcus sync skipped: missing token.');
});

test('no arbitrary command path and command parsing is constrained', () => {
  const commands = Array.from(ALLOWED_GIT_COMMANDS.values());
  assert.ok(commands.includes('status --short'));
  assert.ok(!commands.includes('reset --hard'));

  assert.equal(parseCommand(['status']), 'status');
  assert.equal(parseCommand(['close']), 'close');
  assert.equal(parseCommand(['test']), 'test');
  assert.throws(() => parseCommand(['rm -rf /']), /Usage/);
});
