#!/usr/bin/env node

import assert from "assert/strict";
import {
  createGoldenDemoProjectSnapshot,
  deriveGoldenBaselineId,
} from "../scripts/golden-demo-acceptance.js";

function runBaselineIdDeterminismTest() {
  const payload = {
    buildpack: {
      name: "basys3-open-toolchain",
      version: "0.1.0-dev",
      sha256: "a".repeat(64),
    },
    plannerBackend: "buildpack-open",
    toolVersions: [
      { name: "f4pga", version: "0.1.0-dev", source: "buildpack" },
      { name: "yosys", version: "0.48.0", source: "bundled" },
    ],
    topVerilog: "module top; endmodule\n",
    xdcText: "set_property PACKAGE_PIN W5 [get_ports clk]\n",
  };
  const first = deriveGoldenBaselineId(payload);
  const second = deriveGoldenBaselineId(payload);
  assert.equal(first, second);

  const changed = deriveGoldenBaselineId({
    ...payload,
    toolVersions: [
      { name: "f4pga", version: "0.2.0-dev", source: "buildpack" },
      { name: "yosys", version: "0.48.0", source: "bundled" },
    ],
  });
  assert.notEqual(first, changed);
}

function runProjectSnapshotTest() {
  const snapshot = createGoldenDemoProjectSnapshot({
    top: "top",
    sourcePath: "src/top.v",
    hdlText: "module top; endmodule",
    xdcText: "set_property PACKAGE_PIN W5 [get_ports clk]",
  });
  assert.equal(snapshot.fpga.board, "basys3");
  assert.equal(snapshot.fpga.preset, "basys3-switches-leds-7seg");
  assert.equal(snapshot.hdl.top, "top");
  assert.equal(snapshot.hdl.sources.length, 1);
  assert.equal(snapshot.hdl.sources[0].path, "src/top.v");
  assert.equal(snapshot.hdl.sources[0].language, "verilog");
  assert.match(snapshot.hdl.sources[0].text, /module top/);
  assert.match(snapshot.fpga.constraints.text, /PACKAGE_PIN W5/);
}

runBaselineIdDeterminismTest();
runProjectSnapshotTest();
console.log("[TEST] golden demo acceptance helpers passed");
