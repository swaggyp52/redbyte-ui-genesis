#!/usr/bin/env node

import assert from 'node:assert/strict';
import { runMarcusAgentLoop } from './marcus-agent-loop.mjs';

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

const toolRegistry = {
  hasTool: (name) => ['get_product_snapshot', 'generate_codex_packet', 'git_status'].includes(name),
  listToolsForModel: () => [
    {
      type: 'function',
      function: {
        name: 'get_product_snapshot',
        description: 'snapshot',
        parameters: { type: 'object', properties: {} },
      },
    },
  ],
  executeTool: async (name) => {
    if (name === 'generate_codex_packet') {
      return {
        ok: true,
        summary: 'packet generated',
        data: { artifacts: { markdownPath: '.redbyte/agent/runs/hq/marcus-coding-plan-latest.md' } },
        generatedFiles: ['.redbyte/agent/runs/hq/marcus-coding-plan-latest.md'],
        sources: [
          {
            id: 'packet-1',
            kind: 'generated_run',
            title: 'Marcus coding packet',
            path: '.redbyte/agent/runs/hq/marcus-coding-plan-latest.md',
            excerpt: 'packet generated',
            freshness: 'generated',
            authority: 'generated',
          },
        ],
        sourceConfidence: 'medium',
        authority: 'generated',
      };
    }
    return {
      ok: true,
      summary: `${name} ok`,
      data: {},
      sources: [
        {
          id: `${name}-source`,
          kind: 'repo_doc',
          title: `${name} source`,
          path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
          excerpt: 'repo truth excerpt',
          freshness: 'current',
          authority: 'canonical',
        },
      ],
      sourceConfidence: 'high',
      authority: 'canonical',
    };
  },
};

test('degraded mode works when Ollama is offline', async () => {
  const response = await runMarcusAgentLoop({
    userMessage: 'status',
    mode: 'ask',
    snapshot: { blocked_task: 'x', bench_evidence: { available: false } },
    maxToolCalls: 4,
    allowTools: true,
    toolRegistry,
    callOllamaChat: null,
    ollamaOnline: false,
  });

  assert.equal(response.degraded, true);
  assert.ok(response.warnings.some((item) => item.includes('fallback')));
  assert.ok(response.sources.some((source) => source.kind === 'fallback' || source.kind === 'repo_doc'));
});

test('maxToolCalls is enforced', async () => {
  const response = await runMarcusAgentLoop({
    userMessage: 'status',
    mode: 'ask',
    snapshot: { blocked_task: 'x', bench_evidence: { available: false } },
    maxToolCalls: 1,
    allowTools: true,
    toolRegistry,
    callOllamaChat: async () => ({
      message: {
        tool_calls: [
          { function: { name: 'get_product_snapshot', arguments: '{}' } },
          { function: { name: 'git_status', arguments: '{}' } },
        ],
      },
    }),
    ollamaOnline: true,
  });

  assert.equal(response.toolsUsed.length, 1);
  assert.ok(response.warnings.some((item) => item.includes('maxToolCalls')));
});

test('aggregates structured tool sources and confidence', async () => {
  const response = await runMarcusAgentLoop({
    userMessage: 'status',
    mode: 'ask',
    snapshot: { blocked_task: 'x', bench_evidence: { available: false } },
    maxToolCalls: 2,
    allowTools: true,
    toolRegistry,
    callOllamaChat: async () => ({
      message: {
        tool_calls: [{ function: { name: 'get_product_snapshot', arguments: '{}' } }],
        content: 'grounded reply',
      },
    }),
    ollamaOnline: true,
  });

  assert.ok(Array.isArray(response.sources));
  assert.ok(response.sources.some((source) => source.kind === 'repo_doc'));
  assert.equal(response.sourceConfidence, 'high');
});

test('warns when no tools were used and baseline grounding is weaker', async () => {
  const response = await runMarcusAgentLoop({
    userMessage: 'status',
    mode: 'ask',
    snapshot: { blocked_task: 'x', bench_evidence: { available: false } },
    maxToolCalls: 2,
    allowTools: false,
    toolRegistry,
    callOllamaChat: async () => ({
      message: {
        tool_calls: [],
        content: 'ungrounded reply',
      },
    }),
    ollamaOnline: true,
  });

  assert.ok(response.warnings.some((item) => item.includes('No tools were used')));
  assert.ok(Array.isArray(response.sources));
});
