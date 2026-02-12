function toFiniteNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeLogLevel(level) {
  if (level === "error" || level === "warn" || level === "info") return level;
  return "info";
}

function normalizeRunState(state) {
  if (state === "running" || state === "done" || state === "error" || state === "canceled") return state;
  return "error";
}

function normalizeStep(step) {
  if (
    step === "probe" ||
    step === "preflight" ||
    step === "synth" ||
    step === "implement" ||
    step === "pnr" ||
    step === "bitgen" ||
    step === "buildpack" ||
    step === "program"
  ) {
    return step;
  }
  return "program";
}

function normalizeBoard(board) {
  if (typeof board !== "string") return null;
  const value = board.trim().toLowerCase();
  return value.length > 0 ? value : null;
}

function createRunSnapshot(run, offset = 0) {
  const safeOffset = toFiniteNonNegativeInteger(offset, 0);
  const startOffset = Math.max(safeOffset, run.baseOffset);
  const startIndex = Math.max(0, startOffset - run.baseOffset);
  return {
    runId: run.runId,
    artifactId: run.artifactId,
    board: run.board,
    state: run.state,
    ok: run.ok,
    exitCode: run.exitCode,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    logs: run.logs.slice(startIndex),
    nextOffset: run.nextOffset,
    ...(run.artifact && typeof run.artifact === "object" ? { artifact: run.artifact } : {}),
    ...(run.error ? { error: run.error } : {}),
  };
}

export function formatSseEvent(eventName, payload) {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function normalizeProgramRunOffset(rawOffset) {
  return toFiniteNonNegativeInteger(rawOffset, 0);
}

export function createProgramExecutionRunId(artifactId, sequence) {
  const baseId = typeof artifactId === "string" && artifactId.trim().length > 0 ? artifactId.trim() : "artifact";
  const seq = toFiniteNonNegativeInteger(sequence, 0).toString(36).padStart(4, "0");
  return `${baseId}-r${seq}`;
}

export function createProgramRunRegistry(options = {}) {
  const runs = new Map();
  const logLimit = Math.max(1, toFiniteNonNegativeInteger(options.logLimit, 2000));
  const ttlMs = Math.max(1000, toFiniteNonNegativeInteger(options.ttlMs, 10 * 60 * 1000));
  const step = normalizeStep(options.step);

  function startRun(input) {
    const runId = typeof input?.runId === "string" ? input.runId.trim() : "";
    if (!runId) {
      throw new Error("run_id_required");
    }

    const existing = runs.get(runId);
    if (existing && existing.state === "running") {
      return { ok: false, error: "run_already_running", run: existing };
    }

    const run = {
      runId,
      artifactId: typeof input?.artifactId === "string" ? input.artifactId : runId,
      board: normalizeBoard(input?.board),
      state: "running",
      ok: null,
      exitCode: null,
      error: null,
      cancelRequested: false,
      process: null,
      artifact: null,
      startedAt: Date.now(),
      finishedAt: null,
      logs: [],
      baseOffset: 0,
      nextOffset: 0,
      listeners: new Set(),
    };
    runs.set(runId, run);
    return { ok: true, run };
  }

  function appendLog(runId, level, msg, data, stepOverride) {
    const run = runs.get(runId);
    if (!run || run.state !== "running") return null;

    const entry = {
      run_id: runId,
      ts: run.nextOffset,
      step: normalizeStep(stepOverride ?? step),
      level: normalizeLogLevel(level),
      msg: typeof msg === "string" ? msg : "[program] invalid_log_message",
      ...(data && typeof data === "object" ? { data } : {}),
    };

    run.logs.push(entry);
    run.nextOffset += 1;
    if (run.logs.length > logLimit) {
      const toDrop = run.logs.length - logLimit;
      run.logs.splice(0, toDrop);
      run.baseOffset += toDrop;
    }

    for (const listener of run.listeners) {
      listener.onLog?.(entry);
    }

    return entry;
  }

  function finishRun(runId, summary) {
    const run = runs.get(runId);
    if (!run) return null;
    if (run.state !== "running") {
      return {
        runId: run.runId,
        artifactId: run.artifactId,
        state: run.state,
        ok: run.ok === true,
        exitCode: run.exitCode,
        nextOffset: run.nextOffset,
        ...(run.error ? { error: run.error } : {}),
      };
    }

    const state = normalizeRunState(summary?.state ?? (summary?.ok === true ? "done" : "error"));
    run.state = state === "running" ? "error" : state;
    run.ok = run.state === "done";
    if (typeof summary?.ok === "boolean" && run.state !== "canceled") {
      run.ok = summary.ok;
    }
    run.exitCode = typeof summary?.exitCode === "number" ? summary.exitCode : run.state === "canceled" ? -1 : null;
    run.finishedAt = Date.now();
    run.error = typeof summary?.error === "string" ? summary.error : null;
    run.artifact = summary?.artifact && typeof summary.artifact === "object" ? summary.artifact : run.artifact;
    run.cancelRequested = run.state === "canceled" ? true : run.cancelRequested;
    run.process = null;

    const donePayload = {
      runId: run.runId,
      artifactId: run.artifactId,
      state: run.state,
      ok: run.ok,
      exitCode: run.exitCode,
      nextOffset: run.nextOffset,
      ...(run.artifact && typeof run.artifact === "object" ? { artifact: run.artifact } : {}),
      ...(run.error ? { error: run.error } : {}),
    };

    for (const listener of run.listeners) {
      listener.onDone?.(donePayload);
    }
    run.listeners.clear();
    return donePayload;
  }

  function attachProcess(runId, processHandle) {
    const run = runs.get(runId);
    if (!run || run.state !== "running") return false;
    run.process = processHandle || null;
    return true;
  }

  function clearProcess(runId) {
    const run = runs.get(runId);
    if (!run) return false;
    run.process = null;
    return true;
  }

  function getProcess(runId) {
    const run = runs.get(runId);
    if (!run) return null;
    return run.process ?? null;
  }

  function requestCancel(runId) {
    const run = runs.get(runId);
    if (!run) return { ok: false, error: "run_not_found", run: null };
    if (run.state !== "running") return { ok: true, alreadyFinished: true, run };
    run.cancelRequested = true;
    return { ok: true, alreadyFinished: false, run };
  }

  function isCancelRequested(runId) {
    const run = runs.get(runId);
    if (!run) return false;
    return run.cancelRequested === true;
  }

  function getStatus(runId, offset = 0) {
    const run = runs.get(runId);
    if (!run) return null;
    return createRunSnapshot(run, offset);
  }

  function getActiveRunByBoard(board) {
    const normalizedBoard = normalizeBoard(board);
    if (!normalizedBoard) return null;

    const activeRuns = [];
    for (const run of runs.values()) {
      if (run.state !== "running") continue;
      if (run.board !== normalizedBoard) continue;
      activeRuns.push(run);
    }

    if (activeRuns.length === 0) return null;
    activeRuns.sort((left, right) => {
      if (left.startedAt !== right.startedAt) return left.startedAt - right.startedAt;
      return left.runId.localeCompare(right.runId);
    });
    return activeRuns[0];
  }

  function subscribe(runId, listener) {
    const run = runs.get(runId);
    if (!run) return null;
    run.listeners.add(listener);
    return () => {
      run.listeners.delete(listener);
    };
  }

  function cleanup(nowMs = Date.now()) {
    for (const [runId, run] of runs.entries()) {
      if (!run.finishedAt) continue;
      if (nowMs - run.finishedAt > ttlMs) {
        runs.delete(runId);
      }
    }
  }

  return {
    startRun,
    appendLog,
    finishRun,
    attachProcess,
    clearProcess,
    getProcess,
    requestCancel,
    isCancelRequested,
    getActiveRunByBoard,
    getStatus,
    subscribe,
    cleanup,
    normalizeRunState,
  };
}
