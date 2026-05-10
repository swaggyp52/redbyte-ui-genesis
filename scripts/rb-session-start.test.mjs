#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  START_PACKET_SCHEMA,
  buildStartPacket,
  writeStartPacketFiles,
} from './rb-session-start.mjs';
import { ensurePathInsideSessionDir } from './rb-session-close.mjs';

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-session-start-'));
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'product'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'release'), { recursive: true });

  fs.writeFileSync(path.join(root, 'AI_STATE.md'), '# AI State\n\n## Change Log\n\n- Session closeout landed.\n', 'utf8');
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
      '- RedByte is deterministic.',
      '',
      '## Current UX spine',
      '- Project -> Design -> Verify -> Map Pins / Hardware -> Export',
      '',
      '## Current live blockers',
      '- E3 manual board observation still required.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'docs', 'product', 'RED_BYTE_OPERATING_LOOP.md'), '# Operating Loop\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'product', 'RED_BYTE_MARCUS_SYNC.md'), '# Marcus Sync\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'product', 'RED_BYTE_AGENT_CONTROL_LOOP.md'), '# Agent Control Loop\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'product', 'RED_BYTE_WORK_QUEUE.md'), '# Work Queue\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'release', 'vivado-basys3-certification-matrix.md'), '- E2 is not E3.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'STUDENT_RELEASE_READINESS.md'), '- Keep claims evidence-backed.\n', 'utf8');

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

function offlineFetch() {
  throw new Error('offline');
}

test('packet shape is valid and dirty repo status is represented', async () => {
  const root = makeTempRepo();
  const packet = await buildStartPacket({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    fetchImpl: offlineFetch,
    gitRunner: fakeGitRunner(root),
  });

  assert.equal(packet.schema, START_PACKET_SCHEMA);
  assert.equal(packet.repo.branch, 'main');
  assert.equal(packet.repo.commit, 'abc123def456');
  assert.equal(packet.repo.dirty, true);
  assert.deepEqual(packet.repo.status_short, [' M dirty.txt', '?? .codex/']);
  assert.equal(packet.marcus.reachable, false);
  assert.equal(packet.marcus.next_work_available, false);
  assert.ok(packet.next_recommended_work.length > 0);
});

test('Marcus offline fallback works without token', async () => {
  const root = makeTempRepo();
  process.env.MARCUS_TOKEN = 'never-used';
  const packet = await buildStartPacket({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    fetchImpl: offlineFetch,
    gitRunner: fakeGitRunner(root),
  });
  delete process.env.MARCUS_TOKEN;

  assert.equal(packet.marcus.reachable, false);
  assert.ok(!JSON.stringify(packet).includes('never-used'));
  assert.ok(packet.product_truth.length > 0);
});

test('output is bounded and confined to .redbyte/session', async () => {
  const root = makeTempRepo();
  const packet = await buildStartPacket({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    fetchImpl: offlineFetch,
    gitRunner: fakeGitRunner(root),
  });

  const files = writeStartPacketFiles(root, packet);
  ensurePathInsideSessionDir(root, files.jsonPath);
  ensurePathInsideSessionDir(root, files.markdownPath);

  const bytes = Buffer.byteLength(JSON.stringify(packet), 'utf8');
  assert.ok(bytes < 50_000);
  assert.ok(files.jsonPath.endsWith(path.join('.redbyte', 'session', 'latest-start-packet.json')));
  assert.ok(files.markdownPath.endsWith(path.join('.redbyte', 'session', 'latest-start-packet.md')));
});

test('generated markdown includes next-work and do-not-do sections', async () => {
  const root = makeTempRepo();
  const packet = await buildStartPacket({
    rootDir: root,
    now: new Date('2026-05-10T20:00:00.000Z'),
    fetchImpl: offlineFetch,
    gitRunner: fakeGitRunner(root),
  });

  const files = writeStartPacketFiles(root, packet);
  const markdown = fs.readFileSync(files.markdownPath, 'utf8');
  assert.match(markdown, /## Next Recommended Work/);
  assert.match(markdown, /## Do Not Do/);
});
