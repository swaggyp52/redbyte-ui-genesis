#!/usr/bin/env node
/**
 * Smoke test: Verify bridge is alive
 * - Checks HTTP health endpoint
 * - Connects to WebSocket and captures one event
 * - Exits cleanly with status 0 if both succeed
 */

import http from "http";
import WebSocket from "ws";

const HTTP_PORT = 4242;
const WS_PORT = 4243;

let passed = 0;
let failed = 0;

async function testHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: HTTP_PORT,
        path: "/health",
        method: "GET",
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const obj = JSON.parse(data);
            console.log("[SMOKE] ✅ HTTP /health:", JSON.stringify(obj));
            passed++;
            resolve(true);
          } catch (e) {
            console.error("[SMOKE] ❌ HTTP /health returned non-JSON:", data);
            failed++;
            resolve(false);
          }
        });
      }
    );
    req.on("error", (e) => {
      console.error("[SMOKE] ❌ HTTP /health error:", e.message);
      failed++;
      resolve(false);
    });
    req.end();
  });
}

async function testWebSocket() {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    const timeout = setTimeout(() => {
      ws.close();
      console.error("[SMOKE] ❌ WS timeout (no event received)");
      failed++;
      resolve(false);
    }, 5000);

    ws.on("open", () => {
      console.log("[SMOKE] WS connected...");
    });

    ws.on("message", (data) => {
      clearTimeout(timeout);
      try {
        const obj = JSON.parse(data.toString());
        console.log("[SMOKE] ✅ WS event:", JSON.stringify(obj).substring(0, 120) + "...");
        passed++;
        ws.close();
        resolve(true);
      } catch (e) {
        console.error("[SMOKE] ❌ WS non-JSON:", data.toString());
        failed++;
        ws.close();
        resolve(false);
      }
    });

    ws.on("error", (e) => {
      clearTimeout(timeout);
      console.error("[SMOKE] ❌ WS error:", e.message);
      failed++;
      resolve(false);
    });
  });
}

(async () => {
  console.log("[SMOKE] === Bridge Smoke Test ===");
  console.log("[SMOKE] Testing HTTP health endpoint...");
  await testHealth();

  console.log("[SMOKE] Testing WebSocket events...");
  await testWebSocket();

  console.log(
    `[SMOKE] === Results: ${passed} passed, ${failed} failed ===`
  );
  process.exit(failed > 0 ? 1 : 0);
})();
