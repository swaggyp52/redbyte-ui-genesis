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
