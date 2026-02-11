#!/usr/bin/env node

import assert from "assert/strict";
import {
  buildYosysSynthScript,
  createSynthArtifactId,
  normalizeSynthSources,
  normalizeSynthTop,
  YOSYS_SYNTH_SCRIPT_VERSION,
} from "../src/toolchain-synth.js";

function runTopNormalizationTest() {
  assert.equal(normalizeSynthTop("top"), "top");
  assert.equal(normalizeSynthTop(" top "), "top");
  assert.equal(normalizeSynthTop("1bad"), null);
}

function runSourceNormalizationTest() {
  const normalized = normalizeSynthSources([
    { path: "src\\top.v", language: "verilog", text: "module top; endmodule" },
    { path: "../bad.v", language: "verilog", text: "module bad; endmodule" },
    { path: "helper.vhd", language: "vhdl", text: "" },
  ]);
  assert.equal(normalized.sources.length, 1);
  assert.equal(normalized.sources[0].path, "src/top.v");
  assert.equal(normalized.nonVerilogCount, 1);
  assert.equal(normalized.invalidCount, 1);
}

function runScriptSnapshotTest() {
  const script = buildYosysSynthScript({
    top: "top",
    sourcePaths: ["src/top.v", "src/lib/helper.v"],
  });
  const expected = [
    `# RedByte Yosys synth script (${YOSYS_SYNTH_SCRIPT_VERSION})`,
    "yosys -import",
    'read_verilog -sv "src/lib/helper.v"',
    'read_verilog -sv "src/top.v"',
    "hierarchy -check -top top",
    "proc",
    "opt",
    "techmap",
    "opt",
    "synth_xilinx -top top -family xc7",
    "stat -top top",
    'write_verilog -noattr "out/netlist.v"',
    "",
  ].join("\n");
  assert.equal(script, expected);
}

function runArtifactDeterminismTest() {
  const input = {
    board: "basys3",
    top: "top",
    yosysVersion: "0.47",
    scriptVersion: YOSYS_SYNTH_SCRIPT_VERSION,
    sources: [{ path: "top.v", language: "verilog", text: "module top; endmodule" }],
  };
  const first = createSynthArtifactId(input);
  const second = createSynthArtifactId(input);
  const changed = createSynthArtifactId({
    ...input,
    sources: [{ path: "top.v", language: "verilog", text: "module top; wire a; endmodule" }],
  });
  assert.equal(first, second);
  assert.notEqual(first, changed);
}

runTopNormalizationTest();
runSourceNormalizationTest();
runScriptSnapshotTest();
runArtifactDeterminismTest();
console.log("[TEST] toolchain synth script passed");
