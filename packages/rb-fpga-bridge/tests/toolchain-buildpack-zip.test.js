#!/usr/bin/env node

import assert from "assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createBuildpackZip, parseBuildpackZipArgs } from "../scripts/buildpack-zip.js";

function makeTempBuildpackFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rb-buildpack-zip-"));
  const buildpackDir = path.join(root, "basys3-open-toolchain-0.1.0-dev");
  fs.mkdirSync(path.join(buildpackDir, "bin", "win32-x64"), { recursive: true });
  fs.mkdirSync(path.join(buildpackDir, "share"), { recursive: true });
  fs.writeFileSync(
    path.join(buildpackDir, "buildpack.json"),
    JSON.stringify(
      {
        name: "basys3-open-toolchain",
        version: "0.1.0-dev",
        platformKey: "win32-x64",
        files: [],
        tools: [{ name: "f4pga", relPath: "bin/win32-x64/f4pga.exe", version: "0.1.0-dev" }],
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(path.join(buildpackDir, "bin", "win32-x64", "f4pga.exe"), "fixture-f4pga");
  fs.writeFileSync(path.join(buildpackDir, "share", "README.md"), "fixture-share");
  return buildpackDir;
}

function runParseArgsTest() {
  const parsed = parseBuildpackZipArgs(["C:\\tmp\\buildpack", "--out-dir", "C:\\tmp\\dist", "--include-manifest"]);
  assert.equal(parsed.buildpackDir, path.resolve("C:\\tmp\\buildpack"));
  assert.equal(parsed.outDir, path.resolve("C:\\tmp\\dist"));
  assert.equal(parsed.includeManifest, true);
}

async function runCreateZipTest() {
  const buildpackDir = makeTempBuildpackFixture();
  const outDir = path.join(path.dirname(buildpackDir), "dist");
  const result = await createBuildpackZip({ buildpackDir, outDir });

  assert.equal(path.basename(result.zipPath), "basys3-open-toolchain-0.1.0-dev-win32-x64.zip");
  assert.equal(fs.existsSync(result.zipPath), true);
  assert.match(result.zipSha256, /^[0-9a-f]{64}$/);
  assert.match(result.installUrl, /^file:\/\//);

  const zipBuffer = fs.readFileSync(result.zipPath);
  assert.equal(zipBuffer.indexOf(Buffer.from("buildpack.json", "utf8")) >= 0, true);
  assert.equal(zipBuffer.indexOf(Buffer.from("bin/win32-x64/f4pga.exe", "utf8")) >= 0, true);

  const manifest = JSON.parse(fs.readFileSync(path.join(buildpackDir, "buildpack.json"), "utf8"));
  assert.equal(Array.isArray(manifest.files), true);
  assert.equal(manifest.files.length > 0, true);
  assert.deepEqual(
    manifest.files.map((entry) => entry.path),
    [...manifest.files.map((entry) => entry.path)].sort((left, right) => left.localeCompare(right))
  );
}

runParseArgsTest();
await runCreateZipTest();
console.log("[TEST] toolchain buildpack zip passed");
