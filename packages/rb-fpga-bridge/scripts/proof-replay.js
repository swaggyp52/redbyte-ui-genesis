#!/usr/bin/env node
/**
 * proof-replay.js
 *
 * Deterministically replay a captured proof event stream and produce:
 * - proof-replay-<ts>.md (human-readable report)
 * - proof-replay-<ts>.json (structured results)
 *
 * Usage:
 *   node proof-replay.js fpga-proof-*.json [--outdir <path>] [--strict] [--max-events N]
 *   node proof-replay.js fpga-events-*.ndjson [--outdir <path>] [--strict] [--max-events N]
 *
 * Exit codes:
 *   0: replay successful, all events valid
 *   1: replay failed, at least one event check failed
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse CLI args
const args = process.argv.slice(2);
let inputPath = null;
let outdir = path.resolve(__dirname, "../../..", "ops", "proof");
let strict = false;
let maxEvents = Infinity;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--outdir" && args[i + 1]) {
    outdir = args[++i];
  } else if (args[i] === "--strict") {
    strict = true;
  } else if (args[i] === "--max-events" && args[i + 1]) {
    maxEvents = parseInt(args[++i], 10);
  } else if (!args[i].startsWith("--")) {
    inputPath = args[i];
  }
}

if (!inputPath) {
  console.error("[REPLAY] ❌ Usage: proof-replay.js <fpga-proof.json or fpga-events.ndjson> [--outdir <path>] [--strict]");
  process.exit(1);
}

// Resolve input path (relative or absolute)
const resolvedInputPath = path.isAbsolute(inputPath) 
  ? inputPath 
  : path.resolve(__dirname, "..", "..", "..", inputPath);

// Create outdir
fs.mkdirSync(outdir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
const replayMd = path.join(outdir, `proof-replay-${timestamp}.md`);
const replayJson = path.join(outdir, `proof-replay-${timestamp}.json`);

const log = (msg) => console.log(msg);
const logError = (msg) => console.error(msg);

// Board contract (Basys3 default)
const BOARD_CONTRACT = {
  SW: 16,
  BTN: 5,
  LED: 16,
};

// State tracker
let currentState = {
  SW: "0".repeat(BOARD_CONTRACT.SW),
  BTN: "0".repeat(BOARD_CONTRACT.BTN),
  LED: "0".repeat(BOARD_CONTRACT.LED),
};

const eventResults = [];
let totalEvents = 0;
let failureCount = 0;
let firstTs = null;
let lastTs = null;
let lastSeq = 0;

// Parse input
let events = [];
try {
  // Resolve path (relative to CWD or absolute)
  const content = fs.readFileSync(resolvedInputPath, "utf8");
  
  if (resolvedInputPath.endsWith(".ndjson")) {
    // Parse NDJSON: one JSON per line
    events = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          logError(`[REPLAY] ❌ Failed to parse NDJSON line: ${line}`);
          throw e;
        }
      });
  } else if (resolvedInputPath.endsWith(".json")) {
    // Parse JSON capsule and extract events
    const capsule = JSON.parse(content);
    events = capsule.events || [];
  } else {
    logError(`[REPLAY] ❌ Unknown file format: ${resolvedInputPath}`);
    process.exit(1);
  }
} catch (e) {
  logError(`[REPLAY] ❌ Failed to load proof file: ${e.message}`);
  process.exit(1);
}

if (events.length === 0) {
  logError(`[REPLAY] ❌ No events found in proof`);
  process.exit(1);
}

log(`[REPLAY] 📖 Replaying ${Math.min(events.length, maxEvents)} events...`);

// Replay each event
const normalizedEvents = [];
for (let i = 0; i < Math.min(events.length, maxEvents); i++) {
  const event = events[i];
  totalEvents++;

  const checks = [];
  const failures = [];

  // Check 1: seq is contiguous
  if (typeof event.seq !== "number") {
    failures.push("seq is not a number");
  } else if (event.seq !== lastSeq + 1) {
    failures.push(`seq ${event.seq} not contiguous (expected ${lastSeq + 1})`);
  } else {
    checks.push("seq_contiguous");
    lastSeq = event.seq;
  }

  // Check 2: timestamp is monotonic
  if (typeof event.timestamp !== "number") {
    failures.push("timestamp is not a number");
  } else {
    if (firstTs === null) firstTs = event.timestamp;
    lastTs = event.timestamp;
    
    if (event.timestamp < (lastTs || 0)) {
      failures.push(`timestamp ${event.timestamp} not monotonic`);
    } else {
      checks.push("timestamp_monotonic");
    }
  }

  // Check 3: event type is valid
  if (typeof event.type !== "string") {
    failures.push("type is not a string");
  } else {
    checks.push(`type_${event.type}`);
  }

  // Check 4: if io:update, validate bitstrings
  if (event.type === "io:update") {
    const { SW, BTN, LED } = event;

    if (typeof SW !== "string" || SW.length !== BOARD_CONTRACT.SW) {
      failures.push(`SW bitstring length ${SW?.length} !== ${BOARD_CONTRACT.SW}`);
    } else {
      checks.push("sw_width_valid");
      currentState.SW = SW;
      normalizedEvents.push({ seq: event.seq, timestamp: event.timestamp, type: "io:update", SW, BTN, LED });
    }

    if (typeof BTN !== "string" || BTN.length !== BOARD_CONTRACT.BTN) {
      failures.push(`BTN bitstring length ${BTN?.length} !== ${BOARD_CONTRACT.BTN}`);
    } else {
      checks.push("btn_width_valid");
      currentState.BTN = BTN;
    }

    if (typeof LED !== "string" || LED.length !== BOARD_CONTRACT.LED) {
      failures.push(`LED bitstring length ${LED?.length} !== ${BOARD_CONTRACT.LED}`);
    } else {
      checks.push("led_width_valid");
      currentState.LED = LED;
    }
  } else if (event.type === "status") {
    checks.push("status_event_ok");
    normalizedEvents.push({ seq: event.seq, timestamp: event.timestamp, type: "status" });
  } else {
    if (strict) {
      failures.push(`unknown event type: ${event.type}`);
    } else {
      checks.push("unknown_type_permissive");
    }
  }

  if (failures.length > 0) {
    failureCount++;
  }

  eventResults.push({
    seq: event.seq,
    type: event.type,
    timestamp: event.timestamp,
    checks_passed: checks,
    checks_failed: failures,
    valid: failures.length === 0,
  });
}

// Compute replay hash (deterministic)
const replayHash = createHash("sha256");
for (const evt of normalizedEvents) {
  replayHash.update(JSON.stringify(evt));
}
const replayHashHex = replayHash.digest("hex");

// Build markdown report
const durationSec = firstTs && lastTs ? Math.round((lastTs - firstTs) / 1000) : "?";
const status = failureCount === 0 ? "PASS" : "FAIL";

const mdLines = [
  "# Proof Replay Report",
  "",
  `**Status:** ${status === "PASS" ? "✅ PASS" : "❌ FAIL"}`,
  `**Generated:** ${new Date().toISOString()}`,
  "",
  "## Summary",
  `- **Total Events:** ${totalEvents}`,
  `- **First Timestamp:** ${firstTs || "N/A"}`,
  `- **Last Timestamp:** ${lastTs || "N/A"}`,
  `- **Duration:** ${durationSec}s`,
  `- **Seq Range:** 1 to ${lastSeq}`,
  `- **Replay Hash:** sha256:${replayHashHex}`,
  `- **Failures:** ${failureCount} of ${totalEvents}`,
  "",
  "## Event Details",
  "",
  "| Seq | Type | Timestamp | Status | Checks | Failures |",
  "|-----|------|-----------|--------|--------|----------|",
];

for (const result of eventResults) {
  const status_icon = result.valid ? "✅" : "❌";
  const checks_str = result.checks_passed.join(", ") || "(none)";
  const failures_str = result.checks_failed.length > 0 ? result.checks_failed.join("; ") : "–";
  mdLines.push(`| ${result.seq} | ${result.type} | ${result.timestamp} | ${status_icon} | ${checks_str} | ${failures_str} |`);
}

mdLines.push("");
mdLines.push("## Board Contract");
mdLines.push(`- **SW:** ${BOARD_CONTRACT.SW} bits`);
mdLines.push(`- **BTN:** ${BOARD_CONTRACT.BTN} bits`);
mdLines.push(`- **LED:** ${BOARD_CONTRACT.LED} bits`);
mdLines.push("");
mdLines.push(`**Result:** ${failureCount === 0 ? "All events valid." : `${failureCount} event(s) failed validation.`}`);

const mdContent = mdLines.join("\n");

// Build JSON report
const jsonReport = {
  status,
  timestamp: new Date().toISOString(),
  summary: {
    total_events: totalEvents,
    first_timestamp: firstTs,
    last_timestamp: lastTs,
    duration_sec: durationSec,
    seq_range: { start: 1, end: lastSeq },
    replay_hash: `sha256:${replayHashHex}`,
    failure_count: failureCount,
  },
  board_contract: BOARD_CONTRACT,
  events: eventResults,
};

// Write artifacts
try {
  fs.writeFileSync(replayMd, mdContent, "utf8");
  log(`[REPLAY] ✅ Report: ${replayMd}`);

  fs.writeFileSync(replayJson, JSON.stringify(jsonReport, null, 2), "utf8");
  log(`[REPLAY] ✅ JSON: ${replayJson}`);
} catch (e) {
  logError(`[REPLAY] ❌ Failed to write artifacts: ${e.message}`);
  process.exit(1);
}

// Summary
log("");
log("[REPLAY SUMMARY]");
log(`📊 Events: ${totalEvents} replayed`);
log(`⏱️  Duration: ${durationSec}s`);
log(`🔗 Replay Hash: sha256:${replayHashHex.slice(0, 16)}...`);
log(`🚨 Failures: ${failureCount}`);
log(`✅ Status: ${status}`);
log("");

process.exit(failureCount === 0 ? 0 : 1);
