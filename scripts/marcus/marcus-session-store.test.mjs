#!/usr/bin/env node
/**
 * marcus-session-store.test.mjs
 * Tests for the Marcus HQ session event store.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sanitizeEventType,
  sanitizeSeverity,
  generateEventId,
  ensureSessionDir,
  appendEvent,
  listEvents,
  clearEvents,
} from './marcus-session-store.mjs';

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marcus-session-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- sanitizeEventType ---

test('sanitizeEventType accepts all allowed types', () => {
  const types = ['user_message', 'marcus_reply', 'tool_call', 'tool_result', 'warning', 'degraded_mode', 'packet_saved', 'coding_plan_generated', 'source_grounding', 'runtime_status', 'error'];
  for (const t of types) {
    assert.equal(sanitizeEventType(t), t);
  }
});

test('sanitizeEventType falls back for unknown types', () => {
  assert.equal(sanitizeEventType('unknown_type'), 'runtime_status');
  assert.equal(sanitizeEventType(''), 'runtime_status');
  assert.equal(sanitizeEventType(null), 'runtime_status');
});

// --- sanitizeSeverity ---

test('sanitizeSeverity accepts all severities', () => {
  for (const s of ['info', 'warn', 'error', 'success']) {
    assert.equal(sanitizeSeverity(s), s);
  }
});

test('sanitizeSeverity falls back for unknown values', () => {
  assert.equal(sanitizeSeverity('critical'), 'info');
  assert.equal(sanitizeSeverity(''), 'info');
});

// --- generateEventId ---

test('generateEventId returns a well-formed id', () => {
  const id = generateEventId('user_message');
  assert.match(id, /^user_message-[\dT]{15}-[a-f0-9]{6}$/);
});

test('generateEventId normalizes unknown types', () => {
  const id = generateEventId('unknown');
  assert.match(id, /^runtime_status-/);
});

// --- ensureSessionDir ---

test('ensureSessionDir creates directory if missing', () => {
  withTempDir((dir) => {
    const sessionDir = path.join(dir, 'session');
    assert.ok(!fs.existsSync(sessionDir));
    ensureSessionDir(sessionDir);
    assert.ok(fs.existsSync(sessionDir));
  });
});

// --- appendEvent ---

test('appendEvent writes a JSONL line', () => {
  withTempDir((dir) => {
    const ev = appendEvent({ type: 'user_message', title: 'hello', severity: 'info' }, dir);
    assert.ok(ev.id);
    assert.equal(ev.type, 'user_message');
    assert.equal(ev.severity, 'info');
    const eventsFile = path.join(dir, 'events.jsonl');
    assert.ok(fs.existsSync(eventsFile));
    const lines = fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.id, ev.id);
  });
});

test('appendEvent truncates long title and summary', () => {
  withTempDir((dir) => {
    const ev = appendEvent({
      type: 'marcus_reply',
      title: 'x'.repeat(300),
      summary: 'y'.repeat(600),
      severity: 'success',
    }, dir);
    assert.ok(ev.title.length <= 200);
    assert.ok(ev.summary.length <= 500);
  });
});

test('appendEvent normalizes optional fields', () => {
  withTempDir((dir) => {
    const ev = appendEvent({ type: 'packet_saved', title: 'pkt', severity: 'success', packetId: 'abc123', toolName: 'generate_codex_packet', generatedFiles: ['a.md'] }, dir);
    assert.equal(ev.packetId, 'abc123');
    assert.equal(ev.toolName, 'generate_codex_packet');
    assert.deepEqual(ev.generatedFiles, ['a.md']);
  });
});

// --- listEvents ---

test('listEvents returns empty array when directory does not exist', () => {
  withTempDir((dir) => {
    const result = listEvents({}, path.join(dir, 'nonexistent'));
    assert.deepEqual(result, []);
  });
});

test('listEvents returns events newest-first', () => {
  withTempDir((dir) => {
    appendEvent({ type: 'user_message', title: 'first', severity: 'info' }, dir);
    appendEvent({ type: 'marcus_reply', title: 'second', severity: 'success' }, dir);
    const list = listEvents({}, dir);
    assert.equal(list.length, 2);
    assert.equal(list[0].title, 'second');
    assert.equal(list[1].title, 'first');
  });
});

test('listEvents filters by type', () => {
  withTempDir((dir) => {
    appendEvent({ type: 'user_message', title: 'msg', severity: 'info' }, dir);
    appendEvent({ type: 'warning', title: 'warn', severity: 'warn' }, dir);
    const list = listEvents({ type: 'warning' }, dir);
    assert.equal(list.length, 1);
    assert.equal(list[0].type, 'warning');
  });
});

test('listEvents respects limit', () => {
  withTempDir((dir) => {
    for (let i = 0; i < 5; i++) {
      appendEvent({ type: 'user_message', title: `msg ${i}`, severity: 'info' }, dir);
    }
    const list = listEvents({ limit: 3 }, dir);
    assert.equal(list.length, 3);
  });
});

// --- clearEvents ---

test('clearEvents empties the events file', () => {
  withTempDir((dir) => {
    appendEvent({ type: 'user_message', title: 'hello', severity: 'info' }, dir);
    appendEvent({ type: 'marcus_reply', title: 'world', severity: 'success' }, dir);
    clearEvents(dir);
    const list = listEvents({}, dir);
    assert.equal(list.length, 0);
  });
});

test('clearEvents is safe when no file exists', () => {
  withTempDir((dir) => {
    // Should not throw
    clearEvents(path.join(dir, 'nonexistent'));
  });
});

// Final report
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
