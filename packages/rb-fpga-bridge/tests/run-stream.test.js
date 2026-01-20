#!/usr/bin/env node
/**
 * Run/stream/stop API tests (mock stream).
 */

import http from "http";
import net from "net";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

function requestJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      url,
      {
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : undefined,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data || "{}") });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForHealth(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await requestJson("GET", `${baseUrl}/health`);
      if (result.status === 200 && result.json.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("health_timeout");
}

function collectSamples(url, count, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`stream_status_${res.statusCode}`));
        res.resume();
        return;
      }

      res.setEncoding("utf8");
      let buffer = "";
      let lastEvent = null;
      let samples = 0;

      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            lastEvent = line.slice(6).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            if (lastEvent === "sample") {
              samples += 1;
              if (samples >= count) {
                req.destroy();
                resolve(samples);
                return;
              }
            }
          }
        }
      });
    });

    req.on("error", reject);
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error("stream_timeout"));
    }, timeoutMs);

    req.on("close", () => clearTimeout(timeout));
  });
}

async function run() {
  const httpPort = await getFreePort();
  const wsPort = await getFreePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;

  const child = spawn("node", ["src/index.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      RB_FPGA_HTTP_PORT: String(httpPort),
      RB_FPGA_WS_PORT: String(wsPort),
      RB_FPGA_SIM: "1",
      RB_FPGA_TRACE: "0",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await waitForHealth(baseUrl, 5000);
    const runResp = await requestJson("POST", `${baseUrl}/run`, {
      device_id: "sim",
      mode: "mock",
      hz: 20,
    });

    if (!runResp.json.ok || !runResp.json.run_id) {
      throw new Error("run_failed");
    }

    await collectSamples(`${baseUrl}/stream?run_id=${runResp.json.run_id}`, 3, 1200);

    const stopResp = await requestJson("POST", `${baseUrl}/stop`, {
      run_id: runResp.json.run_id,
    });

    if (!stopResp.json.ok) {
      throw new Error("stop_failed");
    }

    console.log("[TEST] run/stream/stop passed");
  } finally {
    child.kill();
  }
}

run().catch((err) => {
  console.error("[TEST] run/stream/stop failed:", err);
  process.exit(1);
});
