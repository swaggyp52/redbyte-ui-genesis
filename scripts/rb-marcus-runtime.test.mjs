#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildStatusWarnings,
  canStopProcess,
  decideStartAction,
  ensurePathWithin,
  isExpectedHqProcess,
  parseRuntimeState,
  resolveRuntimePaths,
} from './rb-marcus-runtime.mjs';

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

test('offline clarity includes HQ start guidance', () => {
  const warnings = buildStatusWarnings({
    ollamaApi: { reachable: false },
    hq: { ok: false },
    memory: { indexAvailable: true },
    bench: { ok: true },
    control: { ok: true },
  });

  assert.ok(warnings.some((warning) => warning.includes('pnpm rb:marcus:start')));
});

test('duplicate prevention returns already-running when HQ is reachable', () => {
  const decision = decideStartAction({
    hqReachable: true,
    portOpen: true,
    portLooksLikeHq: true,
  });

  assert.equal(decision.action, 'already-running');
});

test('occupied non-HQ port returns explicit failure decision', () => {
  const decision = decideStartAction({
    hqReachable: false,
    portOpen: true,
    portLooksLikeHq: false,
  });

  assert.equal(decision.action, 'fail-port-occupied');
});

test('stop safety allows only expected HQ process identity', () => {
  assert.equal(isExpectedHqProcess('node scripts/rb-hq-server.mjs serve'), true);
  assert.equal(canStopProcess({ pid: 1234, commandLine: 'node scripts/rb-hq-server.mjs serve' }), true);
  assert.equal(canStopProcess({ pid: 1234, commandLine: 'node other-script.mjs' }), false);
  assert.equal(canStopProcess({ pid: 0, commandLine: 'node scripts/rb-hq-server.mjs serve' }), false);
});

test('status-state parsing tolerates malformed JSON', () => {
  const malformed = parseRuntimeState('{ not-json }');
  const valid = parseRuntimeState('{"hqPid":1234}');

  assert.deepEqual(malformed, {});
  assert.equal(valid.hqPid, 1234);
});

test('runtime output paths stay confined to runtime directory', () => {
  const paths = resolveRuntimePaths('C:/repo');

  assert.equal(ensurePathWithin(paths.runtimeDir, paths.stateJson), true);
  assert.equal(ensurePathWithin(paths.runtimeDir, 'C:/repo/.redbyte/agent/runs/hq/runtime/../escape.txt'), false);
});

test('ollama-down guidance is present in warnings', () => {
  const warnings = buildStatusWarnings({
    ollamaApi: { reachable: false },
    hq: { ok: true },
    memory: { indexAvailable: true },
    bench: { ok: true },
    control: { ok: true },
  });

  assert.ok(warnings.some((warning) => warning.toLowerCase().includes('ollama')));
});
