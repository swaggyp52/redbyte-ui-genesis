#!/usr/bin/env node
/**
 * JTAG program helper tests (no hardware required).
 */

import assert from "assert/strict";
import { programJtagBitstream, selectJtagTarget } from "../src/jtag.js";

async function run() {
  const device = {
    id: "board-2100001234",
    serial_number: "2100001234",
    programming: {
      serial_number: "2100001234",
      endpoint_id: "djtgcfg:2100001234",
    },
  };

  const jtagDevices = [
    { serial_number: "2100001234", index: 0, product: "Basys3" },
  ];

  const target = selectJtagTarget({ device, jtagDevices });
  assert.ok(target);
  assert.equal(target.selectorType, "serial");
  assert.equal(target.selector, "2100001234");

  const okResult = await programJtagBitstream({
    toolPath: "djtgcfg",
    selector: target.selector,
    selectorType: target.selectorType,
    bitPath: "C:\\tmp\\design.bit",
    timeoutMs: 1000,
    runner: ({ toolPath, args }) => ({
      ok: toolPath === "djtgcfg",
      exitCode: 0,
      stdout: "program ok",
      stderr: "",
      error: null,
      elapsedMs: 12,
    }),
  });

  assert.equal(okResult.ok, true);
  assert.ok(okResult.command.includes("djtgcfg"));

  const failResult = await programJtagBitstream({
    toolPath: "djtgcfg",
    selector: "2100001234",
    selectorType: "serial",
    bitPath: "C:\\tmp\\design.bit",
    timeoutMs: 1000,
    runner: () => ({
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "failed",
      error: "exit_code:1",
      elapsedMs: 5,
    }),
  });

  assert.equal(failResult.ok, false);
  assert.equal(failResult.exitCode, 1);
  assert.equal(failResult.error, "exit_code:1");

  const missingTool = await programJtagBitstream({
    toolPath: null,
    selector: "2100001234",
    selectorType: "serial",
    bitPath: "C:\\tmp\\design.bit",
    timeoutMs: 1000,
  });

  assert.equal(missingTool.ok, false);
  assert.equal(missingTool.error, "missing_tool");

  console.log("[TEST] jtag program helper passed");
}

run().catch((err) => {
  console.error("[TEST] jtag program helper failed:", err);
  process.exit(1);
});
