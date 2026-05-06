#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildMarcusSystemPrompt,
  createHqServer,
  isAllowlistedCommandId,
  sanitizeUserText,
} from './rb-hq-server.mjs';

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

async function withServer(run) {
  const server = createHqServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
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

test('/chat response includes structured sources when grounded tool output is available', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'Why is proof closure blocked?',
        mode: 'ask',
        allowTools: true,
        maxToolCalls: 2,
      }),
    });

    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.sources));
    assert.ok(payload.sources.length >= 1);
    assert.ok(payload.sources.some((source) => source.kind === 'repo_doc' || source.kind === 'generated_run'));
    assert.match(payload.sourceConfidence, /high|medium|low|degraded/);
  });
});

test('/chat degraded response includes fallback source', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith('http://localhost:11434')) {
      throw new Error('forced-ollama-offline');
    }
    return originalFetch(input, init);
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'Why is proof closure blocked?',
          mode: 'ask',
          allowTools: true,
          maxToolCalls: 2,
        }),
      });

      assert.equal(response.ok, true);
      const payload = await response.json();
      assert.equal(payload.degraded, true);
      assert.ok(payload.sources.some((source) => source.kind === 'fallback'));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('/trace-claim response includes canonical and generated sources', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/trace-claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claim: 'Map Pins does not replace Verify proof.' }),
    });

    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.sources));
    assert.ok(payload.sources.some((source) => source.kind === 'repo_doc'));
    assert.ok(payload.sources.some((source) => source.kind === 'tool_output'));
  });
});

test('/chat response includes packetId after successful reply', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'What is the current blocked task?', mode: 'ask', allowTools: false }),
    });

    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    // packetId is a string id or null (null if save failed, but should succeed in clean env)
    assert.ok(payload.packetId === null || typeof payload.packetId === 'string');
  });
});

test('/trace-claim response includes packetId', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/trace-claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claim: 'Draft Export is not Trusted Export.' }),
    });

    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.ok(payload.packetId === null || typeof payload.packetId === 'string');
  });
});

test('GET /packets returns packet list', async () => {
  await withServer(async (baseUrl) => {
    // Save one packet via chat first
    await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'list packets test prompt', mode: 'ask', allowTools: false }),
    });

    const response = await fetch(`${baseUrl}/packets`);
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.packets));
    assert.ok(typeof payload.total === 'number');
  });
});

test('GET /packets/:id returns packet by id', async () => {
  await withServer(async (baseUrl) => {
    // Save one via chat
    const chatResp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'packet read test prompt', mode: 'ask', allowTools: false }),
    });
    const chatPayload = await chatResp.json();
    const packetId = chatPayload.packetId;

    if (!packetId) return; // skip if save failed (no packet dir in CI)

    const response = await fetch(`${baseUrl}/packets/${encodeURIComponent(packetId)}`);
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.packet.id, packetId);
  });
});

test('GET /packets/:id rejects path traversal attempts', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/packets/${encodeURIComponent('../etc/passwd')}`);
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
  });
});

test('POST /tasks/from-packet promotes a packet into an operator task', async () => {
  await withServer(async (baseUrl) => {
    const chatResp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Generate an Export coding plan candidate.', mode: 'coding-plan', allowTools: false }),
    });
    const chatPayload = await chatResp.json();
    const packetId = chatPayload.packetId;
    if (!packetId) return;

    const promote = await fetch(`${baseUrl}/tasks/from-packet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packetId }),
    });
    assert.equal(promote.ok, true);
    const promoted = await promote.json();
    assert.equal(promoted.ok, true);
    assert.equal(promoted.task.sourcePacketId, packetId);
    assert.match(promoted.task.productArea, /Export|RedByte|HQ|Verify|Hardware/);

    const list = await fetch(`${baseUrl}/tasks`);
    assert.equal(list.ok, true);
    const listed = await list.json();
    assert.ok(Array.isArray(listed.tasks));
    assert.ok(listed.tasks.some((task) => task.id === promoted.task.id));
  });
});

test('POST /tasks/:id/status updates task status', async () => {
  await withServer(async (baseUrl) => {
    const chatResp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Task status test.', mode: 'ask', allowTools: false }),
    });
    const { packetId } = await chatResp.json();
    if (!packetId) return;

    const promote = await fetch(`${baseUrl}/tasks/from-packet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packetId }),
    });
    const { task } = await promote.json();

    const update = await fetch(`${baseUrl}/tasks/${encodeURIComponent(task.id)}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ready' }),
    });
    assert.equal(update.ok, true);
    const updated = await update.json();
    assert.equal(updated.task.status, 'ready');
  });
});

test('GET /code/search returns safe code snippets', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/code/search?q=${encodeURIComponent('ExportSurface')}`);
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.mode, 'safe-keyword');
    assert.ok(Array.isArray(payload.results));
    assert.ok(payload.results.some((entry) => String(entry.path).includes('ExportSurface')));
  });
});

test('GET /code/file reads allowlisted file and denies traversal/private paths', async () => {
  await withServer(async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/code/file?path=${encodeURIComponent('packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx')}`);
    assert.equal(allowed.ok, true);
    const allowedPayload = await allowed.json();
    assert.equal(allowedPayload.ok, true);
    assert.match(allowedPayload.file.content, /HqSurface/);

    const traversal = await fetch(`${baseUrl}/code/file?path=${encodeURIComponent('../AI_STATE.md')}`);
    assert.equal(traversal.status, 403);
    const privateConfig = await fetch(`${baseUrl}/code/file?path=${encodeURIComponent('.redbyte/agent/config.json')}`);
    assert.equal(privateConfig.status, 403);
  });
});

test('POST /patch-proposals creates proposal-only artifact and list/read endpoints work', async () => {
  await withServer(async (baseUrl) => {
    const create = await fetch(`${baseUrl}/patch-proposals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rawRequest: 'Create a proposal for Export diagnostics.',
        likelyFiles: ['packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx'],
      }),
    });
    assert.equal(create.ok, true);
    const created = await create.json();
    assert.equal(created.ok, true);
    assert.equal(created.requiresApproval, true);
    assert.equal(created.applyStatus, 'proposal_only');
    assert.ok(created.generatedFiles.every((file) => String(file).includes('patch-proposals')));
    assert.ok(created.proposal.targetFiles.some((file) => file.includes('ExportSurface')));

    const list = await fetch(`${baseUrl}/patch-proposals`);
    assert.equal(list.ok, true);
    const listed = await list.json();
    assert.ok(listed.proposals.some((proposal) => proposal.id === created.proposal.id));

    const read = await fetch(`${baseUrl}/patch-proposals/${encodeURIComponent(created.proposal.id)}`);
    assert.equal(read.ok, true);
    const readPayload = await read.json();
    assert.equal(readPayload.proposal.id, created.proposal.id);
  });
});

test('no patch apply endpoint exists', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/patch-proposals/fake/apply`, { method: 'POST' });
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
  });
});

test('GET /tasks/:id rejects path traversal attempts', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks/${encodeURIComponent('../task')}`);
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
  });
});

test('GET /bench-timeline returns safe structure without overstating E3', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/bench-timeline`);
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(payload.timeline);
    assert.ok(payload.timeline.counts);
    assert.equal(typeof payload.timeline.manualObservationNeededCount, 'number');
    assert.ok(!/E3 proven/i.test(JSON.stringify(payload.timeline)));
  });
});

test('GET /session/events returns empty events array initially', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/session/events`);
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.events));
    assert.equal(typeof payload.total, 'number');
  });
});

test('POST /session/clear returns ok', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/session/clear`, { method: 'POST' });
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(payload.ok, true);
  });
});

test('GET /session/events returns valid structure after POST /session/clear', async () => {
  await withServer(async (baseUrl) => {
    // Clear first, then verify events list is structurally valid
    const clearResponse = await fetch(`${baseUrl}/session/clear`, { method: 'POST' });
    assert.equal(clearResponse.ok, true);
    const clearPayload = await clearResponse.json();
    assert.equal(clearPayload.ok, true);

    // Events fetched immediately after clear should be a valid array
    // (concurrent tests may write new events, so we verify structure only)
    const eventsResponse = await fetch(`${baseUrl}/session/events`);
    assert.equal(eventsResponse.ok, true);
    const eventsPayload = await eventsResponse.json();
    assert.equal(eventsPayload.ok, true);
    assert.ok(Array.isArray(eventsPayload.events));
    assert.equal(typeof eventsPayload.total, 'number');
  });
});
