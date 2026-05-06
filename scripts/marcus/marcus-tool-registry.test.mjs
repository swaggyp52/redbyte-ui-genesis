#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createMarcusToolRegistry } from './marcus-tool-registry.mjs';

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

const fakeDeps = {
  repoRoot: process.cwd(),
  sanitizeUserText: (value) => String(value || '').trim(),
  runAllowlistedCommand: () => ({ ok: true, stdout: 'ok', stderr: '', status: 0 }),
  buildSnapshot: async () => ({ blocked_task: 'blocked', bench_evidence: { available: false } }),
  loadBenchEvidenceSummary: () => ({ available: false, message: 'none' }),
  gitSummary: () => ({ clean: true, status_short: '', latest_commit: 'abc' }),
};

const registry = createMarcusToolRegistry(fakeDeps);

test('registry contains required safe tools', () => {
  assert.equal(registry.hasTool('get_product_snapshot'), true);
  assert.equal(registry.hasTool('generate_codex_packet'), true);
  assert.equal(registry.hasTool('shell_exec'), false);
});

test('registry exposes model tool definitions', () => {
  const tools = registry.listToolsForModel();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length >= 8);
  assert.equal(tools[0].type, 'function');
});

test('unknown tool is rejected', async () => {
  const result = await registry.executeTool('not_real_tool', {});
  assert.equal(result.ok, false);
  assert.match(result.summary, /Unknown tool/);
});

test('bench evidence tool returns structured source metadata and evidence level', async () => {
  const result = await registry.executeTool('bench_evidence', {});

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.sources));
  assert.ok(result.sources.length >= 1);
  assert.equal(result.sources[0].kind, 'fallback');
  assert.equal(result.authority, 'generated');
  assert.equal(result.evidenceLevel, 'E0');
});

test('trace claim tool returns structured grounding sources', async () => {
  const result = await registry.executeTool('trace_claim', { claim: 'Map Pins does not replace Verify proof.' });

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.sources));
  assert.ok(result.sources.some((source) => source.kind === 'tool_output'));
  assert.equal(result.authority, 'supporting');
});
