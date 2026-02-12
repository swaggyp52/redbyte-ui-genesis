#!/usr/bin/env node

import assert from "assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import {
  getBundledToolRootCandidates,
  getToolPlatformKey,
  resolveBundledToolExecutable,
  resolveManagedToolCandidates,
} from "../src/toolchain-tool-resolver.js";

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createTempToolsRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rb-tools-"));
}

function writeManifest(rootPath, manifest) {
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(path.join(rootPath, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

function writeBinary(rootPath, relativePath, contents) {
  const fullPath = path.join(rootPath, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
  return fullPath;
}

function runPlatformKeyMappingTest() {
  assert.equal(getToolPlatformKey({ platform: "win32", arch: "x64" }), "win32-x64");
  assert.equal(getToolPlatformKey({ platform: "darwin", arch: "arm64" }), "darwin-arm64");
  assert.equal(getToolPlatformKey({ platform: "linux", arch: "x64" }), "linux-x64");
}

function runRootCandidateTest() {
  const roots = getBundledToolRootCandidates({
    repoRoot: path.join("C:", "repo"),
    platform: "win32",
    env: {
      RB_FPGA_BUNDLED_TOOLS_DIR: path.join("D:", "RedByteTools"),
    },
  });
  assert.deepEqual(roots.slice(0, 6), [
    path.join("D:", "RedByteTools", "win32"),
    path.join("D:", "RedByteTools"),
    path.join("C:", "repo", "packages", "rb-fpga-bridge", "tools", "win32"),
    path.join("C:", "repo", "packages", "rb-fpga-bridge", "tools"),
    path.join("C:", "repo", ".redbyte", "tools", "win32"),
    path.join("C:", "repo", ".redbyte", "tools"),
  ]);
}

function runBundledResolverHashMatchTest() {
  const toolsRoot = createTempToolsRoot();
  const binaryRelative = path.join("openFPGALoader", "win32-x64", "openFPGALoader.exe");
  const binaryText = "mock-openfpgaloader-binary";
  const binaryPath = writeBinary(toolsRoot, binaryRelative, binaryText);
  writeManifest(toolsRoot, {
    tools: {
      openFPGALoader: {
        version: "0.99.0",
        bins: {
          "win32-x64": {
            path: binaryRelative.replace(/\\/g, "/"),
            sha256: sha256Text(binaryText),
          },
        },
      },
    },
  });

  const resolved = resolveBundledToolExecutable({
    repoRoot: path.join("C:", "repo"),
    platform: "win32",
    arch: "x64",
    toolId: "openfpgaloader",
    executableName: "openFPGALoader.exe",
    env: {
      RB_FPGA_BUNDLED_TOOLS_DIR: toolsRoot,
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.source, "bundled");
  assert.equal(resolved.status, "ok");
  assert.equal(resolved.integrity, "verified");
  assert.equal(resolved.version, "0.99.0");
  assert.equal(path.resolve(resolved.path), path.resolve(binaryPath));
}

function runBundledResolverHashMismatchTest() {
  const toolsRoot = createTempToolsRoot();
  const binaryRelative = path.join("openFPGALoader", "linux-x64", "openFPGALoader");
  writeBinary(toolsRoot, binaryRelative, "mismatch-binary");
  writeManifest(toolsRoot, {
    tools: {
      openFPGALoader: {
        version: "0.99.0",
        bins: {
          "linux-x64": {
            path: binaryRelative.replace(/\\/g, "/"),
            sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        },
      },
    },
  });

  const resolved = resolveBundledToolExecutable({
    repoRoot: "/repo",
    platform: "linux",
    arch: "x64",
    toolId: "openFPGALoader",
    executableName: "openFPGALoader",
    env: {
      RB_FPGA_BUNDLED_TOOLS_DIR: toolsRoot,
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.source, "bundled");
  assert.equal(resolved.status, "missing");
  assert.equal(resolved.integrity, "corrupt");
  assert.equal(resolved.error, "bundled_sha256_mismatch");
}

function runBundledYosysResolverHashMatchTest() {
  const toolsRoot = createTempToolsRoot();
  const binaryRelative = path.join("yosys", "linux-x64", "yosys");
  const binaryText = "mock-yosys-linux-x64";
  const binaryPath = writeBinary(toolsRoot, binaryRelative, binaryText);
  writeManifest(toolsRoot, {
    tools: {
      yosys: {
        version: "0.48.0",
        bins: {
          "linux-x64": {
            path: binaryRelative.replace(/\\/g, "/"),
            sha256: sha256Text(binaryText),
          },
        },
      },
    },
  });

  const resolved = resolveBundledToolExecutable({
    repoRoot: "/repo",
    platform: "linux",
    arch: "x64",
    toolId: "yosys",
    executableName: "yosys",
    env: {
      RB_FPGA_BUNDLED_TOOLS_DIR: toolsRoot,
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.source, "bundled");
  assert.equal(resolved.status, "ok");
  assert.equal(resolved.integrity, "verified");
  assert.equal(resolved.version, "0.48.0");
  assert.equal(path.resolve(resolved.path), path.resolve(binaryPath));
}

function runBundledYosysResolverHashMismatchTest() {
  const toolsRoot = createTempToolsRoot();
  const binaryRelative = path.join("yosys", "darwin-x64", "yosys");
  writeBinary(toolsRoot, binaryRelative, "mismatch-yosys");
  writeManifest(toolsRoot, {
    tools: {
      yosys: {
        version: "0.48.0",
        bins: {
          "darwin-x64": {
            path: binaryRelative.replace(/\\/g, "/"),
            sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
        },
      },
    },
  });

  const resolved = resolveBundledToolExecutable({
    repoRoot: "/repo",
    platform: "darwin",
    arch: "x64",
    toolId: "yosys",
    executableName: "yosys",
    env: {
      RB_FPGA_BUNDLED_TOOLS_DIR: toolsRoot,
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.source, "bundled");
  assert.equal(resolved.status, "missing");
  assert.equal(resolved.integrity, "corrupt");
  assert.equal(resolved.error, "bundled_sha256_mismatch");
}

function runNoBundledEntryFallsBackToSystemTest() {
  const toolsRoot = createTempToolsRoot();
  writeManifest(toolsRoot, {
    tools: {
      openFPGALoader: {
        version: "0.99.0",
        bins: {},
      },
    },
  });

  const resolved = resolveBundledToolExecutable({
    repoRoot: "/repo",
    platform: "linux",
    arch: "x64",
    toolId: "yosys",
    executableName: "yosys",
    env: {
      RB_FPGA_BUNDLED_TOOLS_DIR: toolsRoot,
    },
    existsSync: () => false,
  });

  assert.equal(resolved, null);
}

function runBuildpackCandidateResolutionTest() {
  const buildpackRoot = createTempToolsRoot();
  const packDir = path.join(buildpackRoot, "basys3-open-toolchain", "0.1.0-dev");
  const binaryRelative = path.join("bin", "yosys").replace(/\\/g, "/");
  const binaryPath = writeBinary(packDir, binaryRelative, "buildpack-yosys");
  fs.writeFileSync(
    path.join(packDir, "buildpack.json"),
    JSON.stringify(
      {
        name: "basys3-open-toolchain",
        version: "0.1.0-dev",
        platformKey: "linux-x64",
        files: [{ path: binaryRelative, sha256: sha256Text("buildpack-yosys") }],
        tools: [{ name: "yosys", relPath: binaryRelative, version: "0.48.0" }],
      },
      null,
      2
    ),
    "utf8"
  );

  const candidates = resolveManagedToolCandidates({
    repoRoot: "/repo",
    platform: "linux",
    arch: "x64",
    toolId: "yosys",
    executableName: "yosys",
    env: {
      RB_FPGA_BUILDPACKS_DIR: buildpackRoot,
    },
    existsSync: fs.existsSync,
  });

  const buildpack = candidates.find((candidate) => candidate?.source === "buildpack");
  assert.ok(buildpack);
  assert.equal(buildpack.status, "ok");
  assert.equal(buildpack.integrity, "verified");
  assert.equal(path.resolve(buildpack.path), path.resolve(binaryPath));
}

runPlatformKeyMappingTest();
runRootCandidateTest();
runBundledResolverHashMatchTest();
runBundledResolverHashMismatchTest();
runBundledYosysResolverHashMatchTest();
runBundledYosysResolverHashMismatchTest();
runNoBundledEntryFallsBackToSystemTest();
runBuildpackCandidateResolutionTest();
console.log("[TEST] toolchain tool resolver passed");
