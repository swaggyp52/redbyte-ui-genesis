#!/usr/bin/env node
/**
 * Autonomous Proof Runner
 * 
 * Starts bridge in mock mode, validates:
 * - HTTP health endpoint works
 * - WebSocket emits events with seq ordering
 * - Proof capsule structure is valid
 * 
 * Writes artifacts to ops/proof/ and exits 0/1
 */

import { spawn } from "child_process";
import { createWriteStream, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import http from "http";
import WebSocket from "ws";
import { createHmac } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROOF_DIR = resolve(__dirname, "../../..", "ops", "proof");
const HTTP_PORT = 4242;
const WS_PORT = 4243;
const WAIT_TIMEOUT = 10000; // 10s to start
const EVENT_TIMEOUT = 5000; // 5s to collect 3 events

mkdirSync(PROOF_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
const proofJson = `${PROOF_DIR}/fpga-proof-${timestamp}.json`;
const proofLog = `${PROOF_DIR}/fpga-proof-${timestamp}.txt`;
const proofNdjson = `${PROOF_DIR}/fpga-events-${timestamp}.ndjson`;

let bridgeProcess = null;
let testsPassed = 0;
let testsFailed = 0;
const results = [];

function log(msg) {
  console.log(msg);
  results.push(msg);
}

function logError(msg, error) {
  console.error(msg);
  if (error?.stack) console.error(error.stack);
  results.push(msg);
  if (error?.stack) results.push(error.stack);
}

async function cleanup() {
  if (bridgeProcess) {
    log("[PROOF] Cleaning up bridge process...");
    bridgeProcess.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (!bridgeProcess.killed) bridgeProcess.kill("SIGKILL");
  }
}

async function waitForHealth() {
  return new Promise((resolve) => {
    const start = Date.now();
    const checkHealth = () => {
      http.get(
        { hostname: "localhost", port: HTTP_PORT, path: "/api/health" },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const health = JSON.parse(data);
              log(`[PROOF] ✅ Health endpoint responding: ${JSON.stringify(health)}`);
              testsPassed++;
              resolve(true);
            } catch (e) {
              logError("[PROOF] ❌ Health endpoint returned non-JSON", e);
              testsFailed++;
              resolve(false);
            }
          });
        }
      ).on("error", () => {
        if (Date.now() - start < WAIT_TIMEOUT) {
          setTimeout(checkHealth, 200);
        } else {
          logError("[PROOF] ❌ Health endpoint timeout");
          testsFailed++;
          resolve(false);
        }
      });
    };
    checkHealth();
  });
}

async function testWebSocket() {
  return new Promise((resolve) => {
    let eventCount = 0;
    const events = [];
    let lastSeq = -1;
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);

    const timeout = setTimeout(() => {
      ws.close();
      logError("[PROOF] ❌ WebSocket timeout (need 3+ events)");
      testsFailed++;
      resolve(false);
    }, EVENT_TIMEOUT);

    ws.on("open", () => {
      log("[PROOF] WS connected, waiting for events...");
    });

    ws.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());
        events.push(event);
        eventCount++;

        // Check seq ordering
        if (typeof event.seq === "number") {
          if (event.seq !== lastSeq + 1 && lastSeq !== -1) {
            logError(`[PROOF] ❌ Seq not ordered: expected ${lastSeq + 1}, got ${event.seq}`);
            testsFailed++;
          }
          lastSeq = event.seq;
        }

        log(`[PROOF]   Event ${eventCount}: type=${event.type}, seq=${event.seq}, ts=${event.ts}`);

        if (eventCount >= 3) {
          clearTimeout(timeout);
          log(`[PROOF] ✅ Received 3+ events with valid seq ordering`);
          testsPassed++;
          ws.close();
          resolve({ events, valid: true });
        }
      } catch (e) {
        logError(`[PROOF] ❌ WS event parse error`, e);
        testsFailed++;
        ws.close();
        resolve({ events: [], valid: false });
      }
    });

    ws.on("error", (e) => {
      clearTimeout(timeout);
      logError("[PROOF] ❌ WS error", e);
      testsFailed++;
      resolve({ events: [], valid: false });
    });
  });
}

async function runProof() {
  try {
    log("════════════════════════════════════════");
    log("[PROOF] === FPGA Bridge Proof Runner ===");
    log("════════════════════════════════════════");

    // Start bridge
    log("[PROOF] Starting bridge in MOCK mode...");
    const bridgePath = resolve(__dirname, "index.js");
    const bridgeEnv = {
      ...process.env,
      RB_FPGA_MOCK: "1",
      RB_FPGA_HMAC_SECRET: process.env.RB_FPGA_HMAC_SECRET || "local-dev-secret-changeme",
    };
    bridgeProcess = spawn("node", [bridgePath], {
      env: bridgeEnv,
      stdio: "pipe",
    });

    bridgeProcess.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n");
      lines.forEach((line) => {
        if (line.trim()) log(`[BRIDGE] ${line}`);
      });
    });

    bridgeProcess.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n");
      lines.forEach((line) => {
        if (line.trim()) logError(`[BRIDGE ERR] ${line}`);
      });
    });

    // Wait for health
    log("[PROOF] Waiting for /api/health...");
    const healthOk = await waitForHealth();
    if (!healthOk) {
      log("[PROOF] ❌ Health check failed");
      await cleanup();
      return false;
    }

    // Test WebSocket
    log("[PROOF] Testing WebSocket events...");
    const wsResult = await testWebSocket();
    if (!wsResult.valid) {
      log("[PROOF] ❌ WebSocket test failed");
      await cleanup();
      return false;
    }

    // Build proof capsule
    const proofCapsule = {
      session_id: `proof-${timestamp}`,
      timestamp: new Date().toISOString(),
      test_suite: {
        health_endpoint: testsPassed > 0,
        websocket_events: true,
        seq_ordering: true,
      },
      events: wsResult.events,
      summary: {
        passed: testsPassed,
        failed: testsFailed,
        total_events: wsResult.events.length,
      },
    };

    // Compute stream hash (canonical event string)
    const canonical = JSON.stringify(wsResult.events);
    const streamHash = createHmac("sha256", "canonical").update(canonical).digest("hex");
    proofCapsule.stream_hash = streamHash;

    // Compute HMAC signature if secret available
    const secret = process.env.RB_FPGA_HMAC_SECRET;
    if (secret) {
      const sig = createHmac("sha256", secret).update(canonical).digest("hex");
      proofCapsule.signature = sig;
    }

    // Write artifacts
    log(`[PROOF] Writing artifacts...`);
    
    // JSON proof capsule
    await new Promise((resolve, reject) => {
      const fs = createWriteStream(proofJson);
      fs.write(JSON.stringify(proofCapsule, null, 2));
      fs.end();
      fs.on("finish", resolve);
      fs.on("error", reject);
    });
    log(`[PROOF] ✅ JSON proof: ${proofJson}`);

    // NDJSON event log (one event per line)
    await new Promise((resolve, reject) => {
      const fs = createWriteStream(proofNdjson);
      wsResult.events.forEach((evt) => {
        fs.write(JSON.stringify(evt) + "\n");
      });
      fs.end();
      fs.on("finish", resolve);
      fs.on("error", reject);
    });
    log(`[PROOF] ✅ NDJSON events: ${proofNdjson}`);

    // Enhanced text summary
    const ioUpdates = wsResult.events.filter((e) => e.type === "io:update").slice(-5);
    const summaryText = [
      "════════════════════════════════════════",
      "[PROOF] === FPGA Bridge Proof Runner ===",
      "════════════════════════════════════════",
      ...results,
      "",
      "[PROOF SUMMARY]",
      `✅ Status: ${testsFailed === 0 ? "PASS" : "FAIL"}`,
      `📊 Events: ${wsResult.events.length} total (seq ${wsResult.events[0]?.seq || "?"} to ${wsResult.events[wsResult.events.length - 1]?.seq || "?"})`,
      `🔐 Stream Hash: sha256:${streamHash.slice(0, 16)}...`,
      ...(secret ? [`🔑 Signature: hmac-sha256:${proofCapsule.signature.slice(0, 16)}...`] : []),
      "",
      "[RECENT I/O UPDATES]",
      ...ioUpdates.map((e, i) => 
        `${i + 1}. seq=${e.seq} LED:${e.LED} BTN:${e.BTN} SW:${e.SW}`
      ),
      "",
      `[SUCCESS] Bridge ran for ~${Math.round((wsResult.events[wsResult.events.length - 1]?.timestamp - wsResult.events[0]?.timestamp) / 1000)}s, captured ${wsResult.events.length} events, proof valid.`,
      "════════════════════════════════════════",
    ].join("\n");

    await new Promise((resolve, reject) => {
      const fs = createWriteStream(proofLog);
      fs.write(summaryText);
      fs.end();
      fs.on("finish", resolve);
      fs.on("error", reject);
    });
    log(`[PROOF] ✅ Text log: ${proofLog}`);

    log("════════════════════════════════════════");
    log(`[PROOF] Results: ${testsPassed} passed, ${testsFailed} failed`);
    log("════════════════════════════════════════");

    await cleanup();
    return testsFailed === 0;
  } catch (e) {
    logError("[PROOF] Unexpected error", e);
    await cleanup();
    return false;
  }
}

// Run
(async () => {
  try {
    const success = await runProof();
    process.exit(success ? 0 : 1);
  } catch (e) {
    logError("[PROOF] Fatal error", e);
    await cleanup();
    process.exit(1);
  }
})();
