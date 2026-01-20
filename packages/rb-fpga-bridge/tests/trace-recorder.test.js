#!/usr/bin/env node
/**
 * Trace recorder serialization test.
 */

import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { TraceRecorder } from "../src/trace/recorder.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-trace-"));
const outPath = path.join(tempDir, "hw_trace.ndjson");

const recorder = new TraceRecorder({ outPath, fs });

recorder.writeEvent({
  hw_tick: 0,
  mono_seq: 1,
  digital: 2,
  analog: [3, 4],
  ts_wall: 123,
});

recorder.writeEvent({
  hw_tick: 1,
  mono_seq: 2,
  digital: 5,
  analog: [6],
  ts_wall: 456,
});

await recorder.close();

const contents = fs.readFileSync(outPath, "utf8");
const expected =
  "{\"hw_tick\":0,\"mono_seq\":1,\"digital\":2,\"analog\":[3,4],\"ts_wall\":123}\n" +
  "{\"hw_tick\":1,\"mono_seq\":2,\"digital\":5,\"analog\":[6],\"ts_wall\":456}\n";

assert.equal(contents, expected);
console.log("[TEST] trace recorder serialization passed");
