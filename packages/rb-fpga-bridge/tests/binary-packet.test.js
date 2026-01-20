#!/usr/bin/env node
/**
 * Unit tests for binary UART packet parser and CRC.
 *
 * Usage: node tests/binary-packet.test.js
 */

import assert from "assert/strict";
import { BinaryPacketParser } from "../src/parsers/binary-packet.js";
import { crc16_ccitt_false } from "../src/parsers/crc16.js";

function buildPacket({ version = 1, flags = 0, sequence = 0, digital = 0, analog = [] }) {
  const buf = Buffer.alloc(28);
  buf[0] = 0x52;
  buf[1] = 0x42;
  buf[2] = version & 0xff;
  buf[3] = flags & 0xff;
  buf.writeUInt32BE(sequence >>> 0, 4);
  buf.writeUInt16BE(digital & 0xffff, 8);
  for (let i = 0; i < 8; i += 1) {
    buf.writeUInt16BE((analog[i] ?? 0) & 0xffff, 10 + i * 2);
  }
  const crc = crc16_ccitt_false(buf.subarray(0, 26));
  buf.writeUInt16BE(crc, 26);
  return buf;
}

async function parseChunks(chunks) {
  const parser = new BinaryPacketParser();
  const frames = [];
  parser.on("data", (frame) => frames.push(frame));

  const done = new Promise((resolve, reject) => {
    parser.on("error", reject);
    parser.on("end", resolve);
  });

  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
  await done;
  return frames;
}

async function run() {
  console.log("[TEST] CRC-16/CCITT-FALSE vector");
  const crcVector = crc16_ccitt_false(Buffer.from("123456789", "ascii"));
  assert.equal(crcVector, 0x29b1);

  console.log("[TEST] Packet CRC acceptance");
  const packet = buildPacket({
    sequence: 0x01020304,
    flags: 0x5a,
    digital: 0xabcd,
    analog: [1, 2, 3, 4, 5, 6, 7, 8],
  });
  const frames1 = await parseChunks([packet]);
  assert.equal(frames1.length, 1);
  assert.equal(frames1[0].protocol, "rb-binary-v1");
  assert.equal(frames1[0].version, 1);
  assert.equal(frames1[0].flags, 0x5a);
  assert.equal(frames1[0].sequence, 0x01020304);
  assert.equal(frames1[0].digital, 0xabcd);
  assert.deepEqual(frames1[0].analog, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(frames1[0].crc_ok, true);

  console.log("[TEST] Resync across garbage + partial frame");
  const packet2 = buildPacket({
    sequence: 0x0a0b0c0d,
    flags: 0x01,
    digital: 0x00ff,
    analog: [9, 10, 11, 12, 13, 14, 15, 16],
  });
  const garbage = Buffer.from([0x00, 0x13, 0x37, 0x55, 0x42]);
  const chunk1 = Buffer.concat([garbage, packet2.slice(0, 5)]);
  const chunk2 = packet2.slice(5, 17);
  const chunk3 = packet2.slice(17);
  const frames2 = await parseChunks([chunk1, chunk2, chunk3]);
  assert.equal(frames2.length, 1);
  assert.equal(frames2[0].sequence, 0x0a0b0c0d);

  console.log("[TEST] Corruption rejection + resync to next frame");
  const packet3 = buildPacket({
    sequence: 0x11111111,
    flags: 0x02,
    digital: 0x0f0f,
    analog: [21, 22, 23, 24, 25, 26, 27, 28],
  });
  const corrupt = Buffer.from(packet3);
  corrupt[12] ^= 0x01;
  const packet4 = buildPacket({
    sequence: 0x22222222,
    flags: 0x03,
    digital: 0xf0f0,
    analog: [31, 32, 33, 34, 35, 36, 37, 38],
  });
  const frames3 = await parseChunks([corrupt, packet4]);
  assert.equal(frames3.length, 1);
  assert.equal(frames3[0].sequence, 0x22222222);

  console.log("[TEST] ALL PASSED");
}

run().catch((err) => {
  console.error("[TEST] FAILED:", err);
  process.exit(1);
});
