#!/usr/bin/env node
/**
 * JTAG enumeration parsing tests (no hardware required).
 */

import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseDjtgcfgEnum } from "../src/jtag.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  const fixturePath = path.join(__dirname, "fixtures", "djtgcfg.enum.txt");
  const raw = fs.readFileSync(fixturePath, "utf8");
  const devices = parseDjtgcfgEnum(raw);

  assert.equal(devices.length, 2);
  assert.equal(devices[0].product, "Basys3");
  assert.equal(devices[0].serial_number, "2100001234");
  assert.equal(devices[0].endpoint_id, "djtgcfg:2100001234");
  assert.equal(devices[1].product, "Spartan3E");
  assert.equal(devices[1].serial_number, "0400005678");
  assert.equal(devices[1].endpoint_id, "djtgcfg:0400005678");

  console.log("[TEST] jtag enum parsing passed");
}

try {
  run();
} catch (err) {
  console.error("[TEST] jtag enum parsing failed:", err);
  process.exit(1);
}
