import { StreamRingBuffer } from './packages/rb-fpga-bridge/src/stream-buffer.js';
console.log("Imported:", StreamRingBuffer);
const buf = new StreamRingBuffer(10);
console.log("Instance:", buf);
