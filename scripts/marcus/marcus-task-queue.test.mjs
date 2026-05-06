#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createTaskFromPacket,
  listTasks,
  readTask,
  sanitizeTaskId,
  sanitizeTaskStatus,
  updateTaskStatus,
} from './marcus-task-queue.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[ok] ${name}`);
    passed++;
  } catch (error) {
    console.error(`[FAIL] ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marcus-task-queue-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function samplePacket(overrides = {}) {
  return {
    id: 'coding_plan-20260506T000000-abc123',
    title: 'Fix Export trust copy',
    summary: 'Clarify Draft Export vs Trusted Export.',
    prompt: 'Make Export honest.',
    reply: 'Codex prompt body.',
    evidenceLevel: 'E2',
    sourceConfidence: 'high',
    requiresApproval: true,
    warnings: ['manual E3 still blocked'],
    generatedFiles: ['.redbyte/agent/runs/hq/marcus-coding-plan-latest.md'],
    sources: [{ id: 'truth', title: 'Current Truth', kind: 'repo_doc', path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md' }],
    ...overrides,
  };
}

test('sanitizeTaskStatus accepts allowed statuses and falls back safely', () => {
  assert.equal(sanitizeTaskStatus('ready'), 'ready');
  assert.equal(sanitizeTaskStatus('in_progress'), 'in_progress');
  assert.equal(sanitizeTaskStatus('shell'), 'candidate');
});

test('sanitizeTaskId blocks traversal', () => {
  assert.throws(() => sanitizeTaskId('../packet'), /traversal|invalid/i);
  assert.throws(() => sanitizeTaskId('a\\b'), /traversal|invalid/i);
  assert.equal(sanitizeTaskId('task-abc_123.json'), 'task-abc_123.json');
});

test('create task from packet writes local task file', () => {
  withTempDir((dir) => {
    const task = createTaskFromPacket(samplePacket(), dir);
    assert.ok(task.id);
    assert.equal(task.status, 'candidate');
    assert.equal(task.sourcePacketId, 'coding_plan-20260506T000000-abc123');
    assert.equal(task.evidenceLevel, 'E2');
    assert.ok(task.doNotTouch.some((item) => /Obsidian/i.test(item)));
    assert.ok(fs.existsSync(path.join(dir, `${task.id}.json`)));
  });
});

test('list/read/update task status', () => {
  withTempDir((dir) => {
    const task = createTaskFromPacket(samplePacket(), dir);
    const list = listTasks({}, dir);
    assert.equal(list.length, 1);
    assert.equal(list[0].blockerCount, 1);

    const read = readTask(task.id, dir);
    assert.equal(read.id, task.id);

    const updated = updateTaskStatus(task.id, 'ready', dir);
    assert.equal(updated.status, 'ready');
    assert.equal(listTasks({ status: 'ready' }, dir).length, 1);
  });
});

test('invalid packet is rejected', () => {
  withTempDir((dir) => {
    assert.throws(() => createTaskFromPacket({}, dir), /Packet id/i);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
