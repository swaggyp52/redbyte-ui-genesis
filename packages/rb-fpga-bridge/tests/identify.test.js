#!/usr/bin/env node
/**
 * Identify protocol tests (no hardware required).
 */

import assert from "assert/strict";
import {
  buildIdentifyRequestFrame,
  decodeIdentifyFrames,
  encodeIdentifyFrame,
  IDENTIFY_TYPE_RESP,
  identifyPort,
  createMockPortResponder,
} from "../src/proto/identify.js";

function splitIntoChunks(buffer, sizes) {
  const chunks = [];
  let offset = 0;
  for (const size of sizes) {
    if (offset >= buffer.length) break;
    const end = Math.min(offset + size, buffer.length);
    chunks.push(buffer.slice(offset, end));
    offset = end;
  }
  if (offset < buffer.length) {
    chunks.push(buffer.slice(offset));
  }
  return chunks;
}

async function run() {
  const payload = {
    kind: "identify",
    board_model_id: "basys3",
    bridge_proto: 1,
    wrapper_version: "0.1.0",
    pinmap_hash: "sha256:deadbeef",
    features: ["io_stream_v1"],
    design: {
      design_hash: "sha256:bead",
      build_id: "spring26.0",
    },
  };

  const responseFrame = encodeIdentifyFrame(IDENTIFY_TYPE_RESP, payload);
  const chunks = splitIntoChunks(responseFrame, [3, 2, 7, 1]);

  let buffer = Buffer.alloc(0);
  let frames = [];
  for (const chunk of chunks) {
    buffer = Buffer.concat([buffer, chunk]);
    const decoded = decodeIdentifyFrames(buffer);
    buffer = decoded.remainder;
    frames = frames.concat(decoded.frames);
  }

  assert.equal(frames.length, 1);
  assert.equal(frames[0].type, IDENTIFY_TYPE_RESP);

  const mock = createMockPortResponder({
    payload,
    split: (frame) => splitIntoChunks(frame, [5, 4, 9]),
  });

  const result = await identifyPort({
    port: "MOCK",
    baud: 115200,
    timeoutMs: 50,
    retries: 1,
    portFactory: () => mock,
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.board_model_id, "basys3");
  assert.equal(result.attempts, 1);

  let requestCount = 0;
  const retryMock = createMockPortResponder({
    payload,
    split: (frame) => [frame],
  });
  const originalWrite = retryMock.write.bind(retryMock);
  retryMock.write = (data) => {
    requestCount += 1;
    if (requestCount < 2) {
      return;
    }
    originalWrite(data);
  };

  const retryResult = await identifyPort({
    port: "MOCK",
    baud: 115200,
    timeoutMs: 20,
    retries: 2,
    backoffMs: [5],
    portFactory: () => retryMock,
  });

  assert.equal(retryResult.ok, true);
  assert.equal(retryResult.attempts, 2);

  const timeoutMock = createMockPortResponder({
    payload,
    split: () => [],
  });
  timeoutMock.write = () => {};

  const timeoutResult = await identifyPort({
    port: "MOCK",
    baud: 115200,
    timeoutMs: 10,
    retries: 2,
    backoffMs: [1],
    portFactory: () => timeoutMock,
  });

  assert.equal(timeoutResult.ok, false);
  assert.equal(timeoutResult.attempts, 2);

  console.log("[TEST] identify protocol passed");
}

run().catch((err) => {
  console.error("[TEST] identify protocol failed:", err);
  process.exit(1);
});
