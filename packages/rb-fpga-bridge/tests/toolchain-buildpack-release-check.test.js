#!/usr/bin/env node

import assert from "assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  runBuildpackReleaseCheck,
} from "../scripts/buildpack-release-check.js";
import { updateBuildpackManifestHashes } from "../scripts/buildpack-hash.js";

function makeTempBuildpackFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rb-buildpack-release-check-"));
  const buildpackDir = path.join(root, "basys3-open-toolchain-0.1.0-dev");
  fs.mkdirSync(path.join(buildpackDir, "bin", "win32-x64"), { recursive: true });
  fs.mkdirSync(path.join(buildpackDir, "share"), { recursive: true });
  fs.mkdirSync(path.join(buildpackDir, "licenses"), { recursive: true });

  fs.writeFileSync(path.join(buildpackDir, "bin", "win32-x64", "f4pga.exe"), "mock-f4pga-binary");
  fs.writeFileSync(path.join(buildpackDir, "bin", "README.md"), "bin readme");
  fs.writeFileSync(path.join(buildpackDir, "share", "README.md"), "share readme");
  fs.writeFileSync(path.join(buildpackDir, "licenses", "README.md"), "licenses readme");
  fs.writeFileSync(path.join(buildpackDir, "README.md"), "fixture");

  fs.writeFileSync(
    path.join(buildpackDir, "buildpack.json"),
    JSON.stringify(
      {
        name: "basys3-open-toolchain",
        version: "0.1.0-dev",
        platformKey: "win32-x64",
        files: [],
        tools: [
          {
            name: "f4pga",
            relPath: "bin/win32-x64/f4pga.exe",
            version: "0.1.0-dev",
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );

  updateBuildpackManifestHashes(buildpackDir);
  return buildpackDir;
}

function readManifest(buildpackDir) {
  return JSON.parse(fs.readFileSync(path.join(buildpackDir, "buildpack.json"), "utf8"));
}

function writeManifest(buildpackDir, manifest) {
  fs.writeFileSync(path.join(buildpackDir, "buildpack.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function runHappyPathTest() {
  const buildpackDir = makeTempBuildpackFixture();
  const report = await runBuildpackReleaseCheck({
    buildpackDir,
    skipToolExec: true,
  });
  assert.equal(report.ok, true);
  assert.equal(report.errors.length, 0);
}

async function runMissingRequiredToolEntryTest() {
  const buildpackDir = makeTempBuildpackFixture();
  const manifest = readManifest(buildpackDir);
  manifest.tools = [];
  writeManifest(buildpackDir, manifest);

  const report = await runBuildpackReleaseCheck({
    buildpackDir,
    skipToolExec: true,
  });
  assert.equal(report.ok, false);
  assert.equal(report.errors.some((entry) => entry.code === "required_tool_missing"), true);
}

async function runFileCoverageFailureTest() {
  const buildpackDir = makeTempBuildpackFixture();
  fs.writeFileSync(path.join(buildpackDir, "share", "unhashed.txt"), "extra");

  const report = await runBuildpackReleaseCheck({
    buildpackDir,
    skipToolExec: true,
  });
  assert.equal(report.ok, false);
  assert.equal(report.errors.some((entry) => entry.code === "file_not_hashed"), true);
}

async function runManifestShaMismatchTest() {
  const buildpackDir = makeTempBuildpackFixture();
  const manifest = readManifest(buildpackDir);
  const target = manifest.files.find((entry) => entry.path === "bin/win32-x64/f4pga.exe");
  assert.ok(target);
  target.sha256 = "0".repeat(64);
  writeManifest(buildpackDir, manifest);

  const report = await runBuildpackReleaseCheck({
    buildpackDir,
    skipToolExec: true,
  });
  assert.equal(report.ok, false);
  assert.equal(report.errors.some((entry) => entry.code === "manifest_sha_mismatch"), true);
}

async function runToolExecFailureTest() {
  const buildpackDir = makeTempBuildpackFixture();
  const report = await runBuildpackReleaseCheck(
    {
      buildpackDir,
      skipToolExec: false,
    },
    {
      runToolCommand: async () => ({
        ok: false,
        exitCode: 1,
        error: "mock_exec_failed",
        stdout: "",
        stderr: "mock",
      }),
    }
  );
  assert.equal(report.ok, false);
  assert.equal(report.errors.some((entry) => entry.code === "tool_exec_failed"), true);
}

await runHappyPathTest();
await runMissingRequiredToolEntryTest();
await runFileCoverageFailureTest();
await runManifestShaMismatchTest();
await runToolExecFailureTest();
console.log("[TEST] toolchain buildpack release check passed");
