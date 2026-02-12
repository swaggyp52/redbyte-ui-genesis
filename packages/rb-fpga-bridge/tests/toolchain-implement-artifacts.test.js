#!/usr/bin/env node

import assert from "assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  createImplementArtifactsZipBuffer,
  readImplementBitstreamArtifact,
  prepareImplementArtifactBundle,
} from "../src/toolchain-implement-artifacts.js";

function hasZipEntry(zipBuffer, entryName) {
  return zipBuffer.indexOf(Buffer.from(entryName, "utf8")) >= 0;
}

async function runCompletedBundleTest() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-implement-artifacts-"));
  const runDir = path.join(repoRoot, ".redbyte", "tmp", "toolchain-implement-run-1");
  fs.mkdirSync(path.join(runDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(runDir, "out"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "src", "top.v"), "module top; endmodule\n");
  fs.writeFileSync(path.join(runDir, "out", "design.bit"), "01020304\n");
  fs.writeFileSync(path.join(runDir, "out", "route.rpt"), "timing ok\n");

  const status = {
    runId: "toolchain-implement-run-1",
    artifactId: "toolchain-implement-artifact-aabbccdd",
    state: "done",
    ok: true,
    exitCode: 0,
    logs: [{ run_id: "toolchain-implement-run-1", ts: 0, step: "implement", level: "info", msg: "done" }],
    artifact: {
      artifactId: "toolchain-implement-artifact-aabbccdd",
      board: "basys3",
      top: "top",
      planId: "build-path-plan-1",
      backend: "nextpnr-xilinx",
      constraintsHash: "implement-xdc-deadbeef",
      commands: [{ step: "bitgen", argv: ["python", "-m", "f4pga.utils.xc7.bitgen"], envKeysUsed: ["PATH"] }],
      requiredTools: [{ name: "yosys", ok: true, version: "0.47", why: "required for synthesis" }],
      sources: [{ path: "top.v", storedPath: ".redbyte/tmp/toolchain-implement-run-1/src/top.v" }],
      outputs: [
        { name: "bitstream", pathHint: "out/design.bit", storedPath: ".redbyte/tmp/toolchain-implement-run-1/out/design.bit" },
        { name: "route-report", pathHint: "out/route.rpt", storedPath: ".redbyte/tmp/toolchain-implement-run-1/out/route.rpt" },
      ],
    },
  };

  const bundle = prepareImplementArtifactBundle({ repoRoot, runId: status.runId, status, includeSources: false });
  const zipBuffer = await createImplementArtifactsZipBuffer(bundle);
  assert.equal(zipBuffer[0], 0x50);
  assert.equal(zipBuffer[1], 0x4b);
  assert.equal(bundle.filename, "rb-implement-toolchain-implement-artifact-aabbccdd.zip");
  assert.equal(hasZipEntry(zipBuffer, "meta.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "commands.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "logs.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "outputs_manifest.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "sources_manifest.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "outputs/bitstream.bit"), true);
  assert.equal(hasZipEntry(zipBuffer, "outputs/route-report.rpt"), true);
  assert.equal(hasZipEntry(zipBuffer, "sources/top.v"), false);

  const bundleWithSources = prepareImplementArtifactBundle({
    repoRoot,
    runId: status.runId,
    status,
    includeSources: true,
  });
  const zipWithSources = await createImplementArtifactsZipBuffer(bundleWithSources);
  assert.equal(hasZipEntry(zipWithSources, "sources_manifest.json"), true);
  assert.equal(hasZipEntry(zipWithSources, "sources/top.v"), true);
}

async function runFailedBundleTest() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-implement-artifacts-failed-"));
  const status = {
    runId: "toolchain-implement-run-fail",
    artifactId: "toolchain-implement-artifact-fail",
    state: "error",
    ok: false,
    exitCode: 1,
    error: "pnr_exit_1",
    logs: [{ run_id: "toolchain-implement-run-fail", ts: 0, step: "pnr", level: "error", msg: "failed" }],
    artifact: {
      artifactId: "toolchain-implement-artifact-fail",
      board: "basys3",
      top: "top",
      planId: "plan-fail",
      backend: "f4pga",
      constraintsHash: "implement-xdc-fail",
      commands: [],
      requiredTools: [],
      sources: [],
      outputs: [],
    },
  };

  const bundle = prepareImplementArtifactBundle({ repoRoot, runId: status.runId, status, includeSources: false });
  const zipBuffer = await createImplementArtifactsZipBuffer(bundle);
  assert.equal(hasZipEntry(zipBuffer, "meta.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "commands.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "logs.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "outputs_manifest.json"), true);
  assert.equal(hasZipEntry(zipBuffer, "error.txt"), true);
}

function runReadBitstreamOutputTest() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-implement-bitstream-"));
  const storedPath = ".redbyte/tmp/toolchain-implement-run-2/out/top.bit";
  const absolutePath = path.join(repoRoot, storedPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from([0xde, 0xad, 0xbe, 0xef]));

  const artifact = {
    outputs: [{ name: "bitstream", pathHint: "out/top.bit", storedPath }],
  };
  const bitstream = readImplementBitstreamArtifact({ repoRoot, artifact });
  assert.ok(bitstream);
  assert.equal(bitstream.filename, "out/top.bit");
  assert.equal(bitstream.kind, "bitstream");
  assert.equal(bitstream.dataBase64, Buffer.from([0xde, 0xad, 0xbe, 0xef]).toString("base64"));
}

await runCompletedBundleTest();
await runFailedBundleTest();
runReadBitstreamOutputTest();
console.log("[TEST] toolchain implement artifacts bundle passed");
