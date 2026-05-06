#!/usr/bin/env node
/**
 * marcus-packet-store.test.mjs
 * Tests for the Marcus workbench packet persistence layer.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sanitizePacketId,
  sanitizePacketType,
  generatePacketId,
  ensurePacketDir,
  savePacket,
  listPackets,
  readPacket,
} from './marcus-packet-store.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[ok] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marcus-packet-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- sanitizePacketType ---

test('sanitizePacketType accepts all allowed types', () => {
  const types = ['chat_answer', 'coding_plan', 'problem_packet', 'trace_report', 'bench_summary', 'control_snapshot', 'patch_proposal', 'fallback_report'];
  for (const t of types) {
    assert.equal(sanitizePacketType(t), t);
  }
});

test('sanitizePacketType falls back to chat_answer for unknown types', () => {
  assert.equal(sanitizePacketType('unknown_type'), 'chat_answer');
  assert.equal(sanitizePacketType(''), 'chat_answer');
  assert.equal(sanitizePacketType(null), 'chat_answer');
});

// --- sanitizePacketId ---

test('sanitizePacketId accepts valid ids', () => {
  const validId = 'chat_answer-20260506T045900Z-abc123';
  assert.equal(sanitizePacketId(validId), validId);
});

test('sanitizePacketId rejects ids with path traversal', () => {
  assert.throws(() => sanitizePacketId('../etc/passwd'), /traversal|invalid/i);
  assert.throws(() => sanitizePacketId('foo/../bar'), /traversal|invalid/i);
  assert.throws(() => sanitizePacketId('foo/bar'), /traversal|invalid/i);
});

test('sanitizePacketId rejects ids with backslashes', () => {
  assert.throws(() => sanitizePacketId('foo\\bar'), /traversal|invalid/i);
});

test('sanitizePacketId rejects empty or too-long ids', () => {
  assert.throws(() => sanitizePacketId(''), /invalid/i);
  assert.throws(() => sanitizePacketId('a'.repeat(121)), /invalid/i);
});

// --- generatePacketId ---

test('generatePacketId returns a well-formed id', () => {
  const id = generatePacketId('chat_answer');
  assert.match(id, /^chat_answer-[\dT]{15}-[a-f0-9]{6}$/);
});

test('generatePacketId normalizes unknown types', () => {
  const id = generatePacketId('unknown_type');
  assert.match(id, /^chat_answer-/);
});

// --- ensurePacketDir ---

test('ensurePacketDir creates directory if missing', () => {
  withTempDir((dir) => {
    const packetDir = path.join(dir, 'packets');
    assert.ok(!fs.existsSync(packetDir));
    ensurePacketDir(packetDir);
    assert.ok(fs.existsSync(packetDir));
  });
});

// --- savePacket ---

test('savePacket writes a JSON file', () => {
  withTempDir((dir) => {
    const saved = savePacket({ type: 'chat_answer', title: 'test', prompt: 'Q', reply: 'A' }, dir);
    assert.ok(saved.id, 'saved packet has id');
    assert.ok(saved.createdAt, 'saved packet has createdAt');
    assert.equal(saved.type, 'chat_answer');
    const filePath = path.join(dir, `${saved.id}.json`);
    assert.ok(fs.existsSync(filePath), 'file exists on disk');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(parsed.id, saved.id);
  });
});

test('savePacket truncates oversized fields', () => {
  withTempDir((dir) => {
    const saved = savePacket({
      type: 'chat_answer',
      title: 'x'.repeat(500),
      reply: 'r'.repeat(10000),
    }, dir);
    assert.ok(saved.title.length <= 200);
    assert.ok(saved.reply.length <= 8000);
  });
});

test('savePacket rejects path traversal in packetDir', () => {
  // The packet dir itself is under a temp dir; check that escaping via id is blocked
  withTempDir((dir) => {
    // savePacket generates its own id — traversal attack would need to craft a valid id
    // The sanitizePacketId is called on any provided id
    assert.throws(() => savePacket({ type: 'chat_answer', id: '../etc/passwd' }, dir), /escaped|invalid/i);
  });
});

// --- listPackets ---

test('listPackets returns empty array when directory is missing', () => {
  withTempDir((dir) => {
    const result = listPackets({}, path.join(dir, 'nonexistent'));
    assert.deepEqual(result, []);
  });
});

test('listPackets returns saved packets newest-first', () => {
  withTempDir((dir) => {
    savePacket({ id: 'trace_report-old', createdAt: '2026-05-06T10:00:00.000Z', type: 'trace_report', title: 'old trace', reply: 'A' }, dir);
    savePacket({ id: 'chat_answer-new', createdAt: '2026-05-06T10:01:00.000Z', type: 'chat_answer', title: 'new chat', reply: 'B' }, dir);
    const list = listPackets({}, dir);
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'chat_answer-new');
    assert.equal(list[1].id, 'trace_report-old');
  });
});

test('listPackets filters by type', () => {
  withTempDir((dir) => {
    savePacket({ type: 'chat_answer', title: 'A', reply: 'a' }, dir);
    savePacket({ type: 'coding_plan', title: 'B', reply: 'b' }, dir);
    const list = listPackets({ type: 'coding_plan' }, dir);
    assert.equal(list.length, 1);
    assert.equal(list[0].type, 'coding_plan');
  });
});

test('listPackets respects limit', () => {
  withTempDir((dir) => {
    for (let i = 0; i < 5; i++) {
      savePacket({ type: 'chat_answer', title: `item ${i}`, reply: 'x' }, dir);
    }
    const list = listPackets({ limit: 3 }, dir);
    assert.equal(list.length, 3);
  });
});

test('listPackets includes warningCount and generatedFileCount', () => {
  withTempDir((dir) => {
    savePacket({ type: 'chat_answer', title: 'W', reply: 'x', warnings: ['w1', 'w2'], generatedFiles: ['f.md'] }, dir);
    const list = listPackets({}, dir);
    assert.equal(list[0].warningCount, 2);
    assert.equal(list[0].generatedFileCount, 1);
  });
});

// --- readPacket ---

test('readPacket returns full packet', () => {
  withTempDir((dir) => {
    const saved = savePacket({ type: 'chat_answer', title: 'read test', reply: 'full reply' }, dir);
    const read = readPacket(saved.id, dir);
    assert.equal(read.id, saved.id);
    assert.equal(read.reply, 'full reply');
  });
});

test('readPacket throws on invalid id', () => {
  withTempDir((dir) => {
    assert.throws(() => readPacket('../etc/passwd', dir), /traversal|invalid/i);
  });
});

test('readPacket throws when packet not found', () => {
  withTempDir((dir) => {
    assert.throws(() => readPacket('chat_answer-20260506T000000Z-aaaaaa', dir), /not found/i);
  });
});

// Final report
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
