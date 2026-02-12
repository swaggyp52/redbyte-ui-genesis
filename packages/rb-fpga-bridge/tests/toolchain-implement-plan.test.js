#!/usr/bin/env node

import assert from "assert/strict";
import {
  buildImplementPlan,
  chooseImplementBackend,
} from "../src/toolchain-implement-plan.js";

function runBackendSelectionTest() {
  const buildpackPreferred = chooseImplementBackend(
    {
      yosys: { version: "0.47", source: "bundled", status: "ok", integrity: "verified" },
      f4pga: {
        version: "1.0",
        source: "buildpack",
        status: "ok",
        integrity: "verified",
        path: "C:/redbyte/buildpacks/basys3-open/bin/f4pga.exe",
        buildpackName: "basys3-open",
        buildpackVersion: "0.1.0",
      },
      vivado: { version: "2024.1", source: "system", status: "ok" },
      nextpnrXilinx: { version: "0.4", source: "system", status: "ok" },
    },
    "linux"
  );
  assert.equal(buildpackPreferred, "buildpack-open");

  const vivadoFallback = chooseImplementBackend(
    {
      yosys: { version: "0.47", source: "buildpack", status: "ok", integrity: "verified" },
      f4pga: { version: "1.0", source: "buildpack", status: "ok", integrity: "corrupt" },
      vivado: { version: "2024.1", source: "system", status: "ok" },
    },
    "win32"
  );
  assert.equal(vivadoFallback, "vivado-fallback");

  const vivadoOverSystemOpen = chooseImplementBackend(
    {
      yosys: { version: "0.47", source: "system", status: "ok" },
      nextpnrXilinx: { version: "0.4", source: "system", status: "ok" },
      vivado: { version: "2024.1", source: "system", status: "ok" },
    },
    "linux"
  );
  assert.equal(vivadoOverSystemOpen, "vivado-fallback");

  const systemOpenFallback = chooseImplementBackend(
    {
      yosys: { version: "0.47", source: "system", status: "ok" },
      nextpnrXilinx: { version: "0.4", source: "system", status: "ok" },
    },
    "linux"
  );
  assert.equal(systemOpenFallback, "nextpnr-xilinx");

  const contractMismatchFallback = chooseImplementBackend(
    {
      yosys: { version: "0.47", source: "bundled", status: "ok", integrity: "verified" },
      f4pga: {
        version: "1.0",
        source: "buildpack",
        status: "ok",
        integrity: "verified",
        buildpackName: "random-buildpack",
        buildpackVersion: "1.0.0",
      },
      vivado: { version: "2024.1", source: "system", status: "ok" },
    },
    "win32"
  );
  assert.equal(contractMismatchFallback, "vivado-fallback");

  const noneBackend = chooseImplementBackend({}, "linux");
  assert.equal(noneBackend, "none");
}

function runPlanShapeTest() {
  const plan = buildImplementPlan({
    backendId: "open",
    platform: "linux",
    capabilities: {
      yosys: { version: "0.47", source: "bundled", status: "ok", integrity: "verified" },
      f4pga: {
        version: "1.0",
        source: "buildpack",
        status: "ok",
        integrity: "verified",
        path: "C:/redbyte/buildpacks/basys3-open/bin/f4pga.exe",
        buildpackName: "basys3-open",
        buildpackVersion: "0.1.0",
      },
    },
    project: {
      hdl: {
        top: "top",
        sources: [
          {
            path: "src/top.v",
            language: "verilog",
            text: "module top(input wire clk, output wire led); assign led = clk; endmodule",
          },
        ],
      },
      fpga: {
        board: "basys3",
        constraints: { type: "xdc", text: "set_property PACKAGE_PIN W5 [get_ports clk]" },
        preset: "basys3-minimal-leds",
      },
    },
  });

  assert.equal(plan.schema_version, "toolchain_implement_plan_v1");
  assert.equal(plan.backend, "buildpack-open");
  assert.equal(plan.ok, true);
  assert.equal(typeof plan.planId, "string");
  assert.deepEqual(plan.buildpack, { name: "basys3-open", version: "0.1.0" });
  assert.equal(plan.commands.length, 3);
  assert.deepEqual(
    plan.commands.map((command) => command.step),
    ["bitgen", "pnr", "synth"]
  );
  assert.deepEqual(
    plan.outputs.map((output) => output.name),
    ["bitstream", "eblif", "fasm"]
  );
  const synthCommand = plan.commands.find((command) => command.step === "synth");
  assert.ok(synthCommand);
  assert.equal(synthCommand.argv[0], "C:/redbyte/buildpacks/basys3-open/bin/f4pga.exe");
  assert.match(synthCommand.argv.join(" "), /--xdc constraints\.xdc/);
  assert.match(synthCommand.argv.join(" "), /--sources src\/top\.v/);
  assert.deepEqual(
    plan.requiredTools.map((tool) => ({
      name: tool.name,
      source: tool.source,
      integrity: tool.integrity,
    })),
    [
      { name: "f4pga", source: "buildpack", integrity: "verified" },
      { name: "yosys", source: "bundled", integrity: "verified" },
    ]
  );
}

function runWarningTest() {
  const plan = buildImplementPlan({
    backendId: "open",
    platform: "win32",
    capabilities: {},
    project: {
      hdl: {
        top: "top",
        sources: [
          {
            path: "top.v",
            language: "vhdl",
            text: "entity top is end entity;",
          },
        ],
      },
      fpga: {
        board: "basys3",
        constraints: null,
      },
    },
  });
  assert.equal(plan.backend, "none");
  assert.equal(plan.ok, false);
  const warningText = plan.warnings.map((entry) => entry.msg).join("\n");
  assert.match(warningText, /missing_xdc_constraints/);
  assert.match(warningText, /no_viable_backend/);

  const contractMismatchPlan = buildImplementPlan({
    backendId: "open",
    platform: "win32",
    capabilities: {
      yosys: { version: "0.47", source: "bundled", status: "ok", integrity: "verified" },
      f4pga: {
        version: "1.0",
        source: "buildpack",
        status: "ok",
        integrity: "verified",
        buildpackName: "random-buildpack",
        buildpackVersion: "1.0.0",
      },
    },
    project: {
      hdl: {
        top: "top",
        sources: [
          {
            path: "top.v",
            language: "verilog",
            text: "module top(input wire clk, output wire led); assign led = clk; endmodule",
          },
        ],
      },
      fpga: {
        board: "basys3",
        constraints: { type: "xdc", text: "set_property PACKAGE_PIN W5 [get_ports clk]" },
      },
    },
  });
  assert.equal(contractMismatchPlan.backend, "none");
  assert.equal(
    contractMismatchPlan.warnings.some((entry) => String(entry.msg).includes("buildpack_contract_mismatch")),
    true
  );
}

runBackendSelectionTest();
runPlanShapeTest();
runWarningTest();
console.log("[TEST] toolchain implement plan passed");
