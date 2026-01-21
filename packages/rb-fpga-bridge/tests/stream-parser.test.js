#!/usr/bin/env node
/**
 * Stream parser tests (no hardware required).
 */

import assert from "assert/strict";
import { createStreamParser } from "../src/stream-parser.js";
import { encodeStreamFrame, STREAM_TYPE_SAMPLE } from "../src/proto/stream.js";

function buildSampleFrame(payload) {
  return encodeStreamFrame(STREAM_TYPE_SAMPLE, payload);
}

function run() {
  const samples = [];
  const parser = createStreamParser({
    onSample: (sample) => samples.push(sample),
  });

  const frame = buildSampleFrame({
    t_us: 50000,
    io: { sw: 8, btn: 0, led: 8, seg: null },
  });

  parser.write(Buffer.from("garbage"));
  parser.write(frame.subarray(0, 5));
  parser.write(frame.subarray(5));

  assert.equal(samples.length, 1);
  assert.equal(samples[0].t_ms, 50);
  assert.equal(samples[0].io.led, 8);

  const frameA = buildSampleFrame({ t_ms: 10, io: { sw: 1, btn: 0, led: 1, seg: null } });
  const frameB = buildSampleFrame({ t_ms: 20, io: { sw: 2, btn: 0, led: 2, seg: null } });
  const combined = Buffer.concat([frameA, frameB]);
  parser.write(combined);

  assert.equal(samples.length, 3);
  assert.equal(samples[1].t_ms, 10);
  assert.equal(samples[2].t_ms, 20);

  console.log("[TEST] binary t_ms parser passed");

  // Test Hex String Timestamp
  const frameC = buildSampleFrame({ t_ms: "0x64", io: { sw: 3, btn: 0, led: 3, seg: null } });
  parser.write(frameC);
  assert.equal(samples.length, 4);
  assert.equal(samples[3].t_ms, 100);

  // Test Decimal String Timestamp
  const frameD = buildSampleFrame({ t_ms: "200", io: { sw: 4, btn: 0, led: 4, seg: null } });
  parser.write(frameD);
  assert.equal(samples.length, 5);
  assert.equal(samples[4].t_ms, 200);

  console.log("[TEST] string t_ms parser passed");
}

try {
  run();
} catch (err) {
  console.error("[TEST] stream parser failed:", err);
  process.exit(1);
}
