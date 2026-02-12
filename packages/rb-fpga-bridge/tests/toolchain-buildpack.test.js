#!/usr/bin/env node

import assert from "assert/strict";
import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getBuildpackStoreRoot,
  parseBuildpackManifest,
  resolveBuildpackToolCandidates,
  verifyBuildpackManifestFiles,
} from "../src/toolchain-buildpack.js";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rb-buildpack-test-"));
}

function runStoreRootSelectionTest() {
  const windows = getBuildpackStoreRoot({
    platform: "win32",
    homedir: "C:\\Users\\student",
    env: {
      LOCALAPPDATA: "C:\\Users\\student\\AppData\\Local",
    },
  });
  assert.equal(windows, path.join("C:\\Users\\student\\AppData\\Local", "redbyte", "buildpacks"));

  const macos = getBuildpackStoreRoot({
    platform: "darwin",
    homedir: "/Users/student",
    env: {},
  });
  assert.equal(macos, path.join("/Users/student", "Library", "Application Support", "redbyte", "buildpacks"));

  const linux = getBuildpackStoreRoot({
    platform: "linux",
    homedir: "/home/student",
    env: {},
  });
  assert.equal(linux, path.join("/home/student", ".local", "share", "redbyte", "buildpacks"));

  const override = getBuildpackStoreRoot({
    platform: "linux",
    homedir: "/home/student",
    env: {
      RB_FPGA_BUILDPACKS_DIR: "/tmp/custom-buildpacks",
    },
  });
  assert.equal(override, path.resolve("/tmp/custom-buildpacks"));
}

function runManifestVerificationTest() {
  const installDir = makeTempRoot();
  const yosysRel = path.join("bin", "yosys").replace(/\\/g, "/");
  const yosysAbs = path.join(installDir, "bin", "yosys");
  fs.mkdirSync(path.dirname(yosysAbs), { recursive: true });
  fs.writeFileSync(yosysAbs, "mock-yosys-binary");

  const manifest = parseBuildpackManifest({
    name: "basys3-open-toolchain",
    version: "0.1.0-dev",
    platformKey: "linux-x64",
    files: [
      {
        path: yosysRel,
        sha256: sha256("mock-yosys-binary"),
      },
    ],
    tools: [
      {
        name: "yosys",
        relPath: yosysRel,
        version: "0.48.0",
      },
    ],
  });

  const verified = verifyBuildpackManifestFiles({ manifest, installDir });
  assert.equal(verified.ok, true);

  fs.writeFileSync(yosysAbs, "tampered-yosys-binary");
  const mismatched = verifyBuildpackManifestFiles({ manifest, installDir });
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.error, "buildpack_file_sha256_mismatch");
}

function runResolveBuildpackToolCandidateTest() {
  const root = makeTempRoot();
  const packDir = path.join(root, "basys3-open-toolchain", "0.1.0-dev");
  const yosysRel = path.join("bin", "yosys").replace(/\\/g, "/");
  const yosysAbs = path.join(packDir, "bin", "yosys");
  fs.mkdirSync(path.dirname(yosysAbs), { recursive: true });
  fs.writeFileSync(yosysAbs, "mock-yosys-binary");
  fs.writeFileSync(
    path.join(packDir, "buildpack.json"),
    JSON.stringify(
      {
        name: "basys3-open-toolchain",
        version: "0.1.0-dev",
        platformKey: "linux-x64",
        files: [
          {
            path: yosysRel,
            sha256: sha256("mock-yosys-binary"),
          },
        ],
        tools: [
          {
            name: "yosys",
            relPath: yosysRel,
            version: "0.48.0",
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );

  const candidates = resolveBuildpackToolCandidates({
    toolId: "yosys",
    platform: "linux",
    arch: "x64",
    env: {
      RB_FPGA_BUILDPACKS_DIR: root,
    },
  });

  assert.equal(Array.isArray(candidates), true);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source, "buildpack");
  assert.equal(candidates[0].status, "ok");
  assert.equal(candidates[0].integrity, "verified");
  assert.equal(path.resolve(candidates[0].path), path.resolve(yosysAbs));
}

runStoreRootSelectionTest();
runManifestVerificationTest();
runResolveBuildpackToolCandidateTest();
console.log("[TEST] toolchain buildpack passed");
