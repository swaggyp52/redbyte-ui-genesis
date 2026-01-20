#!/usr/bin/env node
/**
 * Sim mode smoke test for rb-fpga-bridge.
 *
 * Usage: node tests/sim-mode.test.js
 */

import assert from "assert/strict";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveRepoPath } from "../src/path-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = resolveRepoPath(".");
const httpPort = 44242;
const wsPort = 44243;
const tracePath = path.join(repoRoot, ".redbyte", "tmp", "sim-trace.ndjson");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function run() {
  console.log("[TEST] SIM mode produces frames + trace");
  ensureDir(path.dirname(tracePath));
  if (fs.existsSync(tracePath)) {
    fs.unlinkSync(tracePath);
  }

  const bridgePath = path.join(repoRoot, "packages", "rb-fpga-bridge", "src", "index.js");
  const env = {
    ...process.env,
    RB_FPGA_SIM: "1",
    RB_FPGA_TRACE: "1",
    RB_FPGA_TRACE_PATH: tracePath,
    RB_FPGA_HTTP_PORT: String(httpPort),
    RB_FPGA_WS_PORT: String(wsPort),
  };

  const proc = spawn("node", [bridgePath], {
    cwd: repoRoot,
    env,
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    let health = null;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        health = await fetchJson(`http://127.0.0.1:${httpPort}/health`);
        break;
      } catch {
        await sleep(250);
      }
    }
    assert.ok(health, "bridge health reachable");

    await sleep(1200);
    const after = await fetchJson(`http://127.0.0.1:${httpPort}/health`);
    assert.ok(after.frames_ok_count > 0, "frames_ok_count should be > 0");

    await sleep(500);
    assert.ok(fs.existsSync(tracePath), "trace file should exist");
    const lines = fs
      .readFileSync(tracePath, "utf8")
      .split("\n")
      .filter((line) => line.trim());
    assert.ok(lines.length >= 5, "trace should contain >= 5 events");
  } finally {
    proc.kill();
  }

  console.log("[TEST] ALL PASSED");
}

run().catch((err) => {
  console.error("[TEST] FAILED:", err);
  process.exit(1);
});
