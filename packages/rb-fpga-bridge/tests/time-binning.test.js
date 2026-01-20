#!/usr/bin/env node
/**
 * Deterministic time binning test.
 */

import assert from "assert/strict";
import { createTimeBinner } from "../src/trace/binning.js";

const times = [1000, 1019, 1020, 1039, 1040, 1059, 1060];
const expected = [0, 0, 1, 1, 2, 2, 3];
let index = 0;

const binner = createTimeBinner({
  binSizeMs: 20,
  nowFn: () => times[index++],
});

const actual = [];
for (let i = 0; i < expected.length; i += 1) {
  const ts = binner.now();
  actual.push(binner.compute(ts));
}

assert.deepEqual(actual, expected);
console.log("[TEST] time binning determinism passed");
