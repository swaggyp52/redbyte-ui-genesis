#!/usr/bin/env node
/**
 * Unit tests for Vivado discovery and programming utilities.
 *
 * Usage: node tests/vivado.test.js
 */

import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { findRepoRoot } from "../src/path-utils.js";
import { findVivado, VIVADO_NOT_FOUND_MESSAGE } from "../src/vivado/findVivado.js";
import { programBitstream } from "../src/vivado/programBitstream.js";

const repoRoot = findRepoRoot();
const tmpRoot = path.join(repoRoot, ".redbyte", "tmp", "vivado-tests");

function resetEnv() {
  delete process.env.VIVADO_PATH;
  delete process.env.RB_FPGA_DRYRUN;
  delete process.env.RB_FPGA_CABLE;
  delete process.env.RB_FPGA_DEVICE;
}

async function run() {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });

  console.log("[TEST] findVivado uses VIVADO_PATH override");
  resetEnv();
  const fakeVivadoDir = path.join(tmpRoot, "vivado");
  fs.mkdirSync(fakeVivadoDir, { recursive: true });
  const fakeVivado = path.join(fakeVivadoDir, "vivado.bat");
  fs.writeFileSync(fakeVivado, "@echo off\r\n", "utf8");
  process.env.VIVADO_PATH = fakeVivadoDir;
  const found = findVivado();
  assert.equal(found, path.resolve(fakeVivado));

  console.log("[TEST] findVivado throws expected error when missing");
  process.env.VIVADO_PATH = path.join(tmpRoot, "missing");
  let threw = false;
  try {
    findVivado();
  } catch (err) {
    threw = true;
    assert.equal(err.message, VIVADO_NOT_FOUND_MESSAGE);
  }
  assert.equal(threw, true);

  console.log("[TEST] programBitstream rejects missing bit file");
  resetEnv();
  process.env.RB_FPGA_DRYRUN = "1";
  const missingBit = path.join(tmpRoot, "missing.bit");
  const missingResult = await programBitstream(missingBit);
  assert.equal(missingResult.ok, false);
  assert.match(missingResult.error, /Bit file not found/);
  assert.equal(fs.existsSync(missingResult.logPath), true);

  console.log("[TEST] programBitstream rejects non-.bit extension");
  const wrongExt = path.join(tmpRoot, "not-a-bit.txt");
  fs.writeFileSync(wrongExt, "nope", "utf8");
  const wrongResult = await programBitstream(wrongExt);
  assert.equal(wrongResult.ok, false);
  assert.match(wrongResult.error, /\.bit/);
  assert.equal(fs.existsSync(wrongResult.logPath), true);

  console.log("[TEST] programBitstream dry run writes log");
  const dryBit = path.join(tmpRoot, "design.bit");
  fs.writeFileSync(dryBit, "dummy", "utf8");
  const dryResult = await programBitstream(dryBit);
  assert.equal(dryResult.ok, true);
  const logText = fs.readFileSync(dryResult.logPath, "utf8");
  assert.match(logText, /DRY RUN/);

  resetEnv();
  console.log("[TEST] ALL PASSED");
}

run().catch((err) => {
  console.error("[TEST] FAILED:", err);
  process.exit(1);
});
