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
  searchCode: (query) => ({
    query,
    mode: 'safe-keyword',
    results: [{ path: 'packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx', title: 'HqSurface.tsx', snippet: 'Patch Proposals', score: 1 }],
    warnings: [],
  }),
  readCodeFile: (filePath) => ({ path: filePath, size: 20, truncated: false, content: 'export const value = 1;' }),
  generatePatchProposal: () => ({
    id: 'patch-proposal-test',
    createdAt: new Date().toISOString(),
    title: 'Patch proposal test',
    productProblem: 'Need safe proposal.',
    targetFiles: ['packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx'],
    codeFindings: [],
    proposedChanges: [],
    patchSketch: 'Proposal only. No patch applied.',
    risks: [],
    doNotTouch: [],
    tests: ['pnpm rb:hq:test'],
    validationCommands: ['pnpm rb:hq:test'],
    evidenceSources: [],
    generatedFiles: ['.redbyte/agent/runs/hq/patch-proposals/patch-proposal-test.json'],
    requiresApproval: true,
    applyStatus: 'proposal_only',
    codexPrompt: 'Implement after approval.',
  }),
  listPatchProposals: () => ([{
    id: 'patch-proposal-test',
    createdAt: new Date().toISOString(),
    title: 'Patch proposal test',
    targetFileCount: 1,
    riskCount: 0,
    requiresApproval: true,
    applyStatus: 'proposal_only',
    generatedFiles: ['.redbyte/agent/runs/hq/patch-proposals/patch-proposal-test.json'],
  }]),
};

const registry = createMarcusToolRegistry(fakeDeps);

test('registry contains required safe tools', () => {
  assert.equal(registry.hasTool('get_product_snapshot'), true);
  assert.equal(registry.hasTool('generate_codex_packet'), true);
  assert.equal(registry.hasTool('code_search'), true);
  assert.equal(registry.hasTool('generate_patch_proposal'), true);
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

test('code_search tool exists and returns source metadata', async () => {
  const result = await registry.executeTool('code_search', { query: 'HqSurface' });

  assert.equal(result.ok, true);
  assert.ok(result.sources.some((source) => source.path?.includes('HqSurface.tsx')));
  assert.equal(result.authority, 'supporting');
});

test('generate_patch_proposal returns generated files and requires approval', async () => {
  const result = await registry.executeTool('generate_patch_proposal', { rawRequest: 'Draft proposal' });

  assert.equal(result.ok, true);
  assert.equal(result.data.requiresApproval, true);
  assert.equal(result.data.applyStatus, 'proposal_only');
  assert.ok(result.generatedFiles.some((file) => file.includes('patch-proposals')));
});
