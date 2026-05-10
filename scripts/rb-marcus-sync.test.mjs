#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildRepoSummaryPacket,
  ensurePacketWithinLimit,
  packetSizeBytes,
  sanitizeText,
  syncRepoSummary,
} from './rb-marcus-sync.mjs';

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

function makeFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-marcus-sync-'));
  fs.mkdirSync(path.join(root, 'docs', 'product'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'release'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'AI_STATE.md'),
    [
      '# AI State',
      '',
      '## Change Log 2026-05-10 (infra(marcus): deploy Product Operations v0.4)',
      '',
      '- Added `/repo-summary`, `/product-state`, and `/next-work`.',
      '- No arbitrary shell execution added.',
      '',
      '## Current instruction',
      '',
      '- Never print MARCUS_TOKEN=super-secret-token.',
    ].join('\n'),
  );

  fs.writeFileSync(
    path.join(root, 'docs', 'ACTIVE_WORK.md'),
    [
      '# RedByte Active Work',
      '',
      '> RedByte is an FPGA educational IDE.',
      '',
      '## Top 3 priorities',
      '',
      '1. Close E3 observation honestly for fresh bench rows.',
      '',
      '## Blocked',
      '',
      '| Blocker | Why | Unblock by |',
      '|---------|-----|-----------|',
      '| Final E3 notes | Requires manual board observation | Record physical behavior |',
    ].join('\n'),
  );

  fs.writeFileSync(
    path.join(root, 'docs', 'product', 'RED_BYTE_CURRENT_TRUTH.md'),
    [
      '# RedByte Current Truth',
      '',
      '## 2. Current product thesis',
      '',
      'RedByte is a deterministic, browser-based FPGA educational IDE for the Digilent Basys3 board.',
      '',
      '## 3. Current UX spine',
      '',
      '`Project -> Design -> Verify -> Map Pins / Hardware -> Export`',
      '',
      '## 4. Current live blockers',
      '',
      '- The controlled pack currently classifies `golden-basys3-switch-and`, IDE `signal-tour`, and IDE `two-bit-counter` as E2.',
      '- No physical LED/switch behavior observations are recorded for the controlled pack.',
    ].join('\n'),
  );

  fs.writeFileSync(
    path.join(root, 'docs', 'product', 'RED_BYTE_WORK_QUEUE.md'),
    [
      '# RedByte Work Queue',
      '',
      '| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |',
      '|---|---|---|---|---|---|',
      '| 2 | Finish honest proof closure: `golden` E3 | Main blocker on honest student-safe hardware claims | docs | docs: | proof docs updated |',
      '| 7 | In-app onboarding | First-run orientation should happen inside the product | docs | feat: | users know what to open first |',
    ].join('\n'),
  );

  fs.writeFileSync(
    path.join(root, 'docs', 'release', 'vivado-basys3-certification-matrix.md'),
    [
      '# Matrix',
      '',
      '- Hard rule remains active: E3 cannot be inferred from E2 programming logs.',
      '- Current controlled classification: `golden-basys3-switch-and`, `signal-tour`, and `two-bit-counter` are all **E2**.',
    ].join('\n'),
  );

  return root;
}

test('packet generation is bounded, structured, and sanitized', () => {
  const rootDir = makeFixtureRepo();
  const packet = buildRepoSummaryPacket({
    rootDir,
    now: new Date('2026-05-10T20:00:00.000Z'),
    gitInfo: { branch: 'main', commit: 'abc1234' },
  });

  assert.equal(packet.source, 'redbyte-ui-genesis');
  assert.equal(packet.branch, 'main');
  assert.equal(packet.commit, 'abc1234');
  assert.match(packet.summary, /RedByte/);
  assert.ok(packet.current_product_truth.some((item) => item.includes('Project -> Design -> Verify')));
  assert.ok(packet.active_blockers.some((item) => item.includes('E3')));
  assert.ok(packet.next_recommended_work.some((item) => item.includes('proof closure')));
  assert.ok(packet.evidence_notes.some((item) => item.includes('E2')));
  assert.ok(packet.agent_warnings.some((item) => item.includes('Do not treat E2 as E3')));
  assert.ok(!JSON.stringify(packet).includes('super-secret-token'));
  assert.ok(packetSizeBytes(packet) < 50_000);
  assert.equal(ensurePacketWithinLimit(packet), packet);
});

test('sanitizer redacts token-shaped values', () => {
  const text = sanitizeText('MARCUS_TOKEN=abc123 and X-Marcus-Token: abc123 and marcus.token path');
  assert.ok(!text.includes('abc123'));
  assert.ok(!text.includes('marcus.token'));
  assert.match(text, /\[redacted\]/);
});

test('sync requires token before network work', async () => {
  await assert.rejects(
    () => syncRepoSummary({ baseUrl: 'http://127.0.0.1:4260', packet: {}, token: '', fetchImpl: async () => ({}) }),
    /MARCUS_TOKEN is required/,
  );
});

test('sync posts packet to Marcus repo-summary without exposing token', async () => {
  const packet = {
    source: 'redbyte-ui-genesis',
    branch: 'main',
    commit: 'abc1234',
    generated_at: '2026-05-10T20:00:00.000Z',
    summary: 'Test packet',
    current_product_truth: [],
    recent_changes: [],
    active_blockers: [],
    next_recommended_work: [],
    evidence_notes: [],
    agent_warnings: [],
  };
  const calls = [];
  const result = await syncRepoSummary({
    baseUrl: 'http://marcus.local',
    packet,
    token: 'secret-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'repo_summary_recorded' }),
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://marcus.local/repo-summary');
  assert.equal(calls[0].options.headers['X-Marcus-Token'], 'secret-token');
  assert.equal(JSON.parse(calls[0].options.body).summary, 'Test packet');
  assert.deepEqual(result, { status: 'repo_summary_recorded' });
  assert.ok(!JSON.stringify(result).includes('secret-token'));
});

