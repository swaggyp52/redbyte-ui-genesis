#!/usr/bin/env node

import assert from "assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  collectBuildpackFileHashes,
  updateBuildpackManifestHashes,
} from "../scripts/buildpack-hash.js";

function makeTempBuildpackFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rb-buildpack-hash-"));
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
  fs.writeFileSync(path.join(buildpackDir, "README.md"), "fixture");
  fs.writeFileSync(path.join(buildpackDir, "bin", "win32-x64", "f4pga.exe"), "binary");
  fs.writeFileSync(path.join(buildpackDir, "share", "devdb.txt"), "data");
  return buildpackDir;
}

function runHashGenerationDeterminismTest() {
  const buildpackDir = makeTempBuildpackFixture();

  const first = updateBuildpackManifestHashes(buildpackDir);
  const second = updateBuildpackManifestHashes(buildpackDir);

  assert.deepEqual(first.files, second.files);
  assert.deepEqual(
    first.files.map((entry) => entry.path),
    [...first.files.map((entry) => entry.path)].sort((left, right) => left.localeCompare(right))
  );
  for (const entry of first.files) {
    assert.equal(entry.path.includes("\\"), false);
  }
}

function runManifestInclusionOptionTest() {
  const buildpackDir = makeTempBuildpackFixture();

  const defaultHashes = collectBuildpackFileHashes(buildpackDir);
  assert.equal(defaultHashes.some((entry) => entry.path === "buildpack.json"), false);

  const includeManifestHashes = collectBuildpackFileHashes(buildpackDir, { includeManifest: true });
  assert.equal(includeManifestHashes.some((entry) => entry.path === "buildpack.json"), true);
}

runHashGenerationDeterminismTest();
runManifestInclusionOptionTest();
console.log("[TEST] toolchain buildpack hash passed");
