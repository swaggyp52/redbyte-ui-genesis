#!/usr/bin/env node

import assert from "assert/strict";
import {
  createProgramExecutionRunId,
  createProgramRunRegistry,
  formatSseEvent,
} from "../src/toolchain-program-runs.js";

function runRegistryOffsetTest() {
  const registry = createProgramRunRegistry({ logLimit: 3, ttlMs: 60000 });
  const started = registry.startRun({ runId: "run-1" });
  assert.equal(started.ok, true);

  registry.appendLog("run-1", "info", "line-0");
  registry.appendLog("run-1", "warn", "line-1");
  registry.appendLog("run-1", "error", "line-2");

  const full = registry.getStatus("run-1", 0);
  assert.ok(full);
  assert.equal(full.nextOffset, 3);
  assert.deepEqual(full.logs.map((entry) => entry.ts), [0, 1, 2]);

  const fromOffset = registry.getStatus("run-1", 2);
  assert.ok(fromOffset);
  assert.deepEqual(fromOffset.logs.map((entry) => entry.msg), ["line-2"]);

  registry.appendLog("run-1", "info", "line-3");
  const clipped = registry.getStatus("run-1", 0);
  assert.ok(clipped);
  assert.equal(clipped.nextOffset, 4);
  assert.deepEqual(clipped.logs.map((entry) => entry.ts), [1, 2, 3]);
}

function runSseFrameTest() {
  const frame = formatSseEvent("log", { run_id: "run-2", ts: 1, msg: "ok" });
  assert.equal(frame, 'event: log\ndata: {"run_id":"run-2","ts":1,"msg":"ok"}\n\n');
}

function runDoneStateTest() {
  const registry = createProgramRunRegistry({ logLimit: 5, ttlMs: 60000 });
  registry.startRun({ runId: "run-2" });
  registry.appendLog("run-2", "info", "start");
  registry.finishRun("run-2", { ok: false, exitCode: 2, error: "program_failed" });
  const status = registry.getStatus("run-2", 0);
  assert.ok(status);
  assert.equal(status.state, "error");
  assert.equal(status.ok, false);
  assert.equal(status.exitCode, 2);
  assert.equal(status.error, "program_failed");
}

function runExecutionIdTest() {
  const artifactId = "program-bitstream-aabbccdd";
  const runA = createProgramExecutionRunId(artifactId, 0);
  const runB = createProgramExecutionRunId(artifactId, 1);
  assert.equal(runA, "program-bitstream-aabbccdd-r0000");
  assert.equal(runB, "program-bitstream-aabbccdd-r0001");
  assert.notEqual(runA, runB);
}

function runCancelTransitionTest() {
  const registry = createProgramRunRegistry({ logLimit: 10, ttlMs: 60000 });
  registry.startRun({ runId: "run-3", artifactId: "artifact-3" });
  registry.attachProcess("run-3", { pid: 12345 });

  let doneEvent = null;
  registry.subscribe("run-3", {
    onDone(summary) {
      doneEvent = summary;
    },
  });

  const cancel = registry.requestCancel("run-3");
  assert.equal(cancel.ok, true);
  assert.equal(cancel.alreadyFinished, false);
  registry.appendLog("run-3", "info", "cancel requested");

  const done = registry.finishRun("run-3", {
    state: "canceled",
    ok: false,
    exitCode: -1,
    error: "canceled_by_user",
  });
  assert.ok(done);
  assert.equal(done.state, "canceled");
  assert.equal(done.ok, false);
  assert.equal(done.exitCode, -1);
  assert.equal(done.error, "canceled_by_user");
  assert.equal(doneEvent?.state, "canceled");

  const status = registry.getStatus("run-3", 0);
  assert.ok(status);
  assert.equal(status.state, "canceled");
  assert.equal(status.ok, false);
  assert.equal(status.exitCode, -1);
  assert.equal(status.error, "canceled_by_user");
}

function runCancelAfterDoneNoopTest() {
  const registry = createProgramRunRegistry({ logLimit: 10, ttlMs: 60000 });
  registry.startRun({ runId: "run-4" });
  registry.finishRun("run-4", { ok: true, exitCode: 0 });
  const cancel = registry.requestCancel("run-4");
  assert.equal(cancel.ok, true);
  assert.equal(cancel.alreadyFinished, true);
  const status = registry.getStatus("run-4", 0);
  assert.ok(status);
  assert.equal(status.state, "done");
}

function runActiveBoardLockTest() {
  const registry = createProgramRunRegistry({ logLimit: 10, ttlMs: 60000 });
  registry.startRun({ runId: "run-b1", board: "basys3" });
  registry.startRun({ runId: "run-b2", board: "basys3" });
  registry.startRun({ runId: "run-other", board: "other" });
  const active = registry.getActiveRunByBoard("basys3");
  assert.ok(active);
  assert.equal(active.runId, "run-b1");
  assert.equal(active.board, "basys3");

  registry.finishRun("run-b1", { ok: false, state: "canceled", exitCode: -1, error: "canceled_by_user" });
  const nextActive = registry.getActiveRunByBoard("basys3");
  assert.ok(nextActive);
  assert.equal(nextActive.runId, "run-b2");
}

function runCustomStepTest() {
  const registry = createProgramRunRegistry({ logLimit: 10, ttlMs: 60000, step: "synth" });
  registry.startRun({ runId: "run-synth" });
  registry.appendLog("run-synth", "info", "synth-start");
  const status = registry.getStatus("run-synth", 0);
  assert.ok(status);
  assert.equal(status.logs.length, 1);
  assert.equal(status.logs[0].step, "synth");
}

function runStepOverrideTest() {
  const registry = createProgramRunRegistry({ logLimit: 10, ttlMs: 60000, step: "implement" });
  registry.startRun({ runId: "run-impl" });
  registry.appendLog("run-impl", "info", "pnr-line", null, "pnr");
  registry.appendLog("run-impl", "warn", "bitgen-line", null, "bitgen");
  const status = registry.getStatus("run-impl", 0);
  assert.ok(status);
  assert.equal(status.nextOffset, 2);
  assert.deepEqual(
    status.logs.map((entry) => ({ step: entry.step, msg: entry.msg })),
    [
      { step: "pnr", msg: "pnr-line" },
      { step: "bitgen", msg: "bitgen-line" },
    ]
  );
}

runRegistryOffsetTest();
runSseFrameTest();
runDoneStateTest();
runExecutionIdTest();
runCancelTransitionTest();
runCancelAfterDoneNoopTest();
runActiveBoardLockTest();
runCustomStepTest();
runStepOverrideTest();
console.log("[TEST] toolchain program run registry passed");
