// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import fs from 'fs';
import path from 'path';
import { TickEngine, deserialize, type SerializedCircuitV1 } from '@redbyte/rb-logic-core';

const DEFAULT_TICKS = 20000;
const DEFAULT_REPORT_EVERY = 2000;
const DEFAULT_EXAMPLE = path.join(
  process.cwd(),
  'packages',
  'rb-apps',
  'src',
  'examples',
  '01_wire-lamp.json'
);

const ticks = Number.parseInt(process.env.PERF_SOAK_TICKS ?? '', 10) || DEFAULT_TICKS;
const reportEvery = Number.parseInt(process.env.PERF_SOAK_REPORT_EVERY ?? '', 10) || DEFAULT_REPORT_EVERY;
const examplePath = process.env.PERF_SOAK_EXAMPLE ?? DEFAULT_EXAMPLE;

const raw = fs.readFileSync(examplePath, 'utf8');
const serialized = JSON.parse(raw) as SerializedCircuitV1;
const circuit = deserialize(serialized);

const tickEngine = new TickEngine(circuit, { tickRate: 60 });

const startHeap = process.memoryUsage().heapUsed;
let peakHeap = startHeap;

for (let i = 1; i <= ticks; i += 1) {
  tickEngine.stepOnce();
  if (i % reportEvery === 0 || i === ticks) {
    const heap = process.memoryUsage().heapUsed;
    peakHeap = Math.max(peakHeap, heap);
    const heapMb = (heap / 1024 / 1024).toFixed(1);
    console.log(`[perf-soak] tick ${i} heap ${heapMb}MB`);
  }
}

const endHeap = process.memoryUsage().heapUsed;
const startMb = (startHeap / 1024 / 1024).toFixed(1);
const endMb = (endHeap / 1024 / 1024).toFixed(1);
const peakMb = (peakHeap / 1024 / 1024).toFixed(1);

console.log(`[perf-soak] start ${startMb}MB end ${endMb}MB peak ${peakMb}MB`);

if (endHeap > startHeap * 1.5) {
  console.warn('[perf-soak] heap growth exceeded 1.5x baseline');
  process.exitCode = 1;
}
