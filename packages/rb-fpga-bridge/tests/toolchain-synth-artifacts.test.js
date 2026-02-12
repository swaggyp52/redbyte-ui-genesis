#!/usr/bin/env node

import assert from "assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  createSynthArtifactsZipBuffer,
  prepareSynthArtifactBundle,
} from "../src/toolchain-synth-artifacts.js";

function hasZipEntry(zipBuffer, entryName) {
  const marker = Buffer.from(entryName, "utf8");
  return zipBuffer.indexOf(marker) >= 0;
}

async function runCompletedBundleTest() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-synth-artifacts-"));
  const runDir = path.join(repoRoot, ".redbyte", "tmp", "run-1");
  fs.mkdirSync(path.join(runDir, "out"), { recursive: true });
  fs.mkdirSync(path.join(runDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "run.ys"), "read_verilog -sv \"src/top.v\"\n");
  fs.writeFileSync(path.join(runDir, "src", "top.v"), "module top; endmodule\n");
  fs.writeFileSync(path.join(runDir, "out", "netlist.v"), "module top; endmodule\n");
  fs.writeFileSync(path.join(runDir, "out", "stat.txt"), "=== top ===\n");
  fs.writeFileSync(path.join(runDir, "out", "stats.json"), "{\"schema_version\":\"toolchain_synth_stats_v1\"}\n");

  const status = {
    runId: "run-1",
    artifactId: "toolchain-synth-aabbccdd",
    state: "done",
    ok: true,
    exitCode: 0,
    logs: [{ run_id: "run-1", ts: 0, step: "synth", level: "info", msg: "done" }],
    artifact: {
      artifactId: "toolchain-synth-aabbccdd",
      board: "basys3",
      top: "top",
      yosysVersion: "0.47",
      scriptVersion: "rb_yosys_synth_v1",
      buildPath: {
        planId: "build-path-plan-1",
        backend: "nextpnr-xilinx",
      },
      sourcePaths: [".redbyte/tmp/run-1/src/top.v"],
      outputs: {
        runScript: ".redbyte/tmp/run-1/run.ys",
        netlistVerilog: ".redbyte/tmp/run-1/out/netlist.v",
        statText: ".redbyte/tmp/run-1/out/stat.txt",
        statsJson: ".redbyte/tmp/run-1/out/stats.json",
      },
    },
  };

  const bundle = prepareSynthArtifactBundle({ repoRoot, runId: "run-1", status, includeSources: false });
  const zipBuffer = await createSynthArtifactsZipBuffer(bundle);
  assert.equal(zipBuffer[0], 0x50);
  assert.equal(zipBuffer[1], 0x4b);
  assert.equal(bundle.filename, "rb-synth-toolchain-synth-aabbccdd.zip");
  assert.equal(hasZipEntry(zipBuffer, "meta.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "logs.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "netlist.v"), true);
  assert.equal(hasZipEntry(zipBuffer, "stat.txt"), true);
  assert.equal(hasZipEntry(zipBuffer, "stats.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "run.ys"), true);
  assert.equal(hasZipEntry(zipBuffer, "sources_manifest.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "sources/top.v"), false);

  const bundleWithSources = prepareSynthArtifactBundle({ repoRoot, runId: "run-1", status, includeSources: true });
  const zipBufferWithSources = await createSynthArtifactsZipBuffer(bundleWithSources);
  assert.equal(hasZipEntry(zipBufferWithSources, "sources_manifest.json"), true);
  assert.equal(hasZipEntry(zipBufferWithSources, "sources/top.v"), true);
}

async function runFailedBundleTest() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-synth-artifacts-failed-"));
  const status = {
    runId: "run-fail",
    artifactId: "toolchain-synth-fail",
    state: "error",
    ok: false,
    exitCode: 1,
    error: "yosys_exit_1",
    logs: [{ run_id: "run-fail", ts: 0, step: "synth", level: "error", msg: "failed" }],
    artifact: {
      artifactId: "toolchain-synth-fail",
      board: "basys3",
      top: "top",
      scriptVersion: "rb_yosys_synth_v1",
      outputs: {},
    },
  };

  const bundle = prepareSynthArtifactBundle({ repoRoot, runId: "run-fail", status, includeSources: false });
  const zipBuffer = await createSynthArtifactsZipBuffer(bundle);
  assert.equal(hasZipEntry(zipBuffer, "meta.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "logs.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "sources_manifest.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "error.txt"), true);
}

await runCompletedBundleTest();
await runFailedBundleTest();
console.log("[TEST] toolchain synth artifacts bundle passed");
