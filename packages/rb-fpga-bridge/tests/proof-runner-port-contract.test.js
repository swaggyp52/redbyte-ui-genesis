#!/usr/bin/env node
/**
 * Proof runner port-isolation contract.
 *
 * The scheduled CI proof must not kill an unrelated process on the default
 * local bridge port. In dynamic mode it should choose isolated ports for the
 * child bridge process and still produce a valid proof run.
 */

import assert from "assert/strict";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { resolveRepoPath } from "../src/path-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = resolveRepoPath(".");
const bridgePackageRoot = path.join(repoRoot, "packages", "rb-fpga-bridge");
const artifactDir = path.join(repoRoot, ".redbyte", "tmp", "proof-port-contract");

function waitForLine(child, pattern, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${pattern}; output=${output}`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
      if (pattern.test(output)) {
        clearTimeout(timeout);
        resolve(output);
      }
    });

    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`Port holder exited early: code=${code} signal=${signal}; output=${output}`));
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function run() {
  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  const holder = spawn(
    process.execPath,
    [
      "-e",
      [
        "const http = require('http');",
        "const server = http.createServer((_req, res) => res.end('occupied'));",
        "server.listen(4242, '127.0.0.1', () => console.log('PORT_HOLDER_READY'));",
        "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
        "setInterval(() => {}, 1000);",
      ].join(""),
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );

  try {
    await waitForLine(holder, /PORT_HOLDER_READY/);

    const result = spawnSync(process.execPath, ["src/proof-runner.js"], {
      cwd: bridgePackageRoot,
      env: {
        ...process.env,
        RB_FPGA_PROOF_PORT_MODE: "dynamic",
        RB_FPGA_PROOF_ARTIFACT_DIR: artifactDir,
        RB_FPGA_HMAC_SECRET: "port-contract-secret",
      },
      encoding: "utf8",
      timeout: 20000,
      windowsHide: true,
    });

    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
    assert.equal(result.status, 0, `proof runner should pass in dynamic mode:\n${combinedOutput}`);
    assert.equal(
      holder.exitCode,
      null,
      `proof runner must not kill the unrelated 4242 holder:\n${combinedOutput}`
    );
    const portMatch = combinedOutput.match(/Using .* ports: HTTP (\d+), WS (\d+)/i);
    assert.ok(portMatch, `proof runner should log selected proof ports:\n${combinedOutput}`);
    const selectedHttpPort = Number(portMatch[1]);
    const selectedWsPort = Number(portMatch[2]);
    assert.notEqual(selectedHttpPort, selectedWsPort, "proof HTTP and WS ports must be distinct");
    assert.ok(await canBind(selectedHttpPort), `proof HTTP port ${selectedHttpPort} should be released after cleanup`);
    assert.ok(await canBind(selectedWsPort), `proof WS port ${selectedWsPort} should be released after cleanup`);

    const proofFiles = fs.readdirSync(artifactDir).filter((entry) => entry.startsWith("fpga-proof-"));
    const proofJson = proofFiles.find((entry) => entry.endsWith(".json"));
    assert.ok(proofJson, "proof JSON artifact should be written");

    const verifyResult = spawnSync(process.execPath, ["scripts/proof-verify.js", path.join(artifactDir, proofJson)], {
      cwd: bridgePackageRoot,
      env: {
        ...process.env,
        RB_FPGA_HMAC_SECRET: "port-contract-secret",
      },
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(
      verifyResult.status,
      0,
      `proof verifier should accept the generated artifact:\n${verifyResult.stdout || ""}\n${verifyResult.stderr || ""}`
    );
  } finally {
    await stopChild(holder);
  }

  console.log("[TEST] proof runner port isolation passed");
}

run().catch((err) => {
  console.error("[TEST] proof runner port isolation failed:", err);
  process.exit(1);
});
