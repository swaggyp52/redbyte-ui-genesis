function normalizeRunKind(kind) {
  return kind === "program" || kind === "synth" || kind === "implement" || kind === "buildpack" ? kind : "program";
}

function stepForKind(kind) {
  if (kind === "synth") return "synth";
  if (kind === "implement") return "implement";
  if (kind === "buildpack") return "buildpack";
  return "program";
}

export function findRunRegistryById(runId, registries) {
  const safeRunId = typeof runId === "string" ? runId.trim() : "";
  if (!safeRunId) return null;
  for (const item of Array.isArray(registries) ? registries : []) {
    const registry = item?.registry;
    if (!registry || typeof registry.getStatus !== "function") continue;
    const status = registry.getStatus(safeRunId, 0);
    if (!status) continue;
    return {
      kind: normalizeRunKind(item?.kind),
      registry,
      status,
    };
  }
  return null;
}

export async function cancelToolchainRun({
  runId,
  registries,
  terminateProcessTree,
}) {
  const located = findRunRegistryById(runId, registries);
  if (!located) {
    return {
      ok: false,
      error: "run_not_found",
      kind: null,
      status: null,
    };
  }

  const { kind, registry } = located;
  const currentStatus = registry.getStatus(runId, 0);
  if (!currentStatus) {
    return {
      ok: false,
      error: "run_not_found",
      kind,
      status: null,
    };
  }
  if (currentStatus.state !== "running") {
    return {
      ok: true,
      kind,
      status: currentStatus,
      canceled: currentStatus.state === "canceled",
    };
  }

  const cancelRequest = registry.requestCancel(runId);
  if (!cancelRequest?.ok) {
    return {
      ok: false,
      error: "run_not_found",
      kind,
      status: null,
    };
  }

  const step = stepForKind(kind);
  registry.appendLog(runId, "info", `[bridge] ${kind}: cancel requested`, undefined, step);
  const proc = registry.getProcess(runId);
  if (!proc || !Number.isInteger(proc.pid)) {
    registry.appendLog(runId, "warn", `[bridge] ${kind}: process handle unavailable; marking canceled`, undefined, step);
    registry.appendLog(runId, "warn", `[bridge] ${kind}: canceled by user`, undefined, step);
    registry.finishRun(runId, {
      state: "canceled",
      ok: false,
      exitCode: -1,
      error: "canceled_by_user",
    });
    return {
      ok: true,
      kind,
      status: registry.getStatus(runId, 0),
      canceled: true,
    };
  }

  const termination =
    typeof terminateProcessTree === "function"
      ? await terminateProcessTree(proc.pid)
      : { ok: false, error: "terminate_process_tree_unavailable" };
  if (!termination?.ok) {
    registry.appendLog(runId, "error", `[bridge] ${kind}: cancel_failed: ${termination?.error || "unknown"}`, undefined, step);
    registry.appendLog(
      runId,
      "warn",
      `[bridge] ${kind}: hint: cancel failed; close conflicting tool sessions (Vivado/other) and retry.`,
      undefined,
      step
    );
    return {
      ok: false,
      error: "cancel_failed",
      kind,
      status: registry.getStatus(runId, 0),
    };
  }

  registry.appendLog(
    runId,
    "warn",
    `[bridge] ${kind}: process terminated (${termination.signal || "unknown"})`,
    undefined,
    step
  );
  registry.appendLog(runId, "warn", `[bridge] ${kind}: canceled by user`, undefined, step);
  registry.finishRun(runId, {
    state: "canceled",
    ok: false,
    exitCode: -1,
    error: "canceled_by_user",
  });
  return {
    ok: true,
    kind,
    status: registry.getStatus(runId, 0),
    canceled: true,
  };
}
