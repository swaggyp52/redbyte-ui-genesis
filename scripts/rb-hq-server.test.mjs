#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildMarcusSystemPrompt,
  isAllowlistedCommandId,
  sanitizeUserText,
} from './rb-hq-server.mjs';

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

test('allowlist accepts known command ids', () => {
  assert.equal(isAllowlistedCommandId('control-next'), true);
  assert.equal(isAllowlistedCommandId('bench-evidence-classify'), true);
  assert.equal(isAllowlistedCommandId('trace-claim'), true);
  assert.equal(isAllowlistedCommandId('problem-trace'), true);
  assert.equal(isAllowlistedCommandId('problem-prompt'), true);
  assert.equal(isAllowlistedCommandId('validate-docs'), true);
  assert.equal(isAllowlistedCommandId('encoding-check'), true);
});

test('allowlist rejects unknown command ids', () => {
  assert.equal(isAllowlistedCommandId('shell-exec'), false);
  assert.equal(isAllowlistedCommandId('rm-rf'), false);
  assert.equal(isAllowlistedCommandId('git-commit'), false);
  assert.equal(isAllowlistedCommandId('git-push'), false);
  assert.equal(isAllowlistedCommandId('write-obsidian'), false);
});

test('sanitizeUserText strips multiline payloads', () => {
  const sanitized = sanitizeUserText('hello\nworld\tagent');
  assert.equal(sanitized, 'hello world agent');
});

test('Marcus system prompt carries RedByte trust boundaries', () => {
  const prompt = buildMarcusSystemPrompt();
  assert.match(prompt, /Marcus/);
  assert.match(prompt, /E2 board programming/);
  assert.match(prompt, /Map Pins/);
  assert.match(prompt, /Draft Export/);
});
