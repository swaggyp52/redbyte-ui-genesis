#!/usr/bin/env node

import assert from "assert/strict";
import { createProgramRunRegistry } from "../src/toolchain-program-runs.js";
import { cancelToolchainRun } from "../src/toolchain-run-cancel.js";

async function runImplementCancelTest() {
  const implementRegistry = createProgramRunRegistry({ logLimit: 20, ttlMs: 60000, step: "implement" });
  const started = implementRegistry.startRun({ runId: "implement-run-1", artifactId: "artifact-1", board: "basys3" });
  assert.equal(started.ok, true);
  implementRegistry.attachProcess("implement-run-1", { pid: 4242 });
  implementRegistry.appendLog("implement-run-1", "info", "started", null, "implement");

  let doneSummary = null;
  implementRegistry.subscribe("implement-run-1", {
    onDone(summary) {
      doneSummary = summary;
    },
  });

  const calls = [];
  const cancellation = await cancelToolchainRun({
    runId: "implement-run-1",
    registries: [{ kind: "implement", registry: implementRegistry }],
    terminateProcessTree: async (pid) => {
      calls.push(pid);
      return { ok: true, signal: "SIGTERM" };
    },
  });

  assert.equal(cancellation.ok, true);
  assert.equal(cancellation.kind, "implement");
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 4242);
  assert.ok(cancellation.status);
  assert.equal(cancellation.status.state, "canceled");
  assert.equal(cancellation.status.error, "canceled_by_user");
  assert.equal(doneSummary?.state, "canceled");
}

async function runNotFoundTest() {
  const cancellation = await cancelToolchainRun({
    runId: "missing-run",
    registries: [],
    terminateProcessTree: async () => ({ ok: true }),
  });
  assert.equal(cancellation.ok, false);
  assert.equal(cancellation.error, "run_not_found");
}

await runImplementCancelTest();
await runNotFoundTest();
console.log("[TEST] toolchain run cancel passed");
