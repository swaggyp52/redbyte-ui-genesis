import { RBEvents } from "./EventBus";

export type ProcessStatus = "running" | "suspended" | "stopped";
export type ProcessType = "window" | "daemon" | "system";

export interface RBProcess {
  pid: string;
  type: ProcessType;
  label: string;
  appId?: string;
  windowId?: string;
  status: ProcessStatus;
  cpu: number; // simulated usage 0-100
  memory: number; // simulated MB
  startedAt: number;
  lastActiveAt: number;
}

type ProcessListener = (processes: RBProcess[]) => void;

let processes: RBProcess[] = [];
let listeners: ProcessListener[] = [];

function notify() {
  const snapshot = [...processes];
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch {
      // ignore listener errors
    }
  }
}

export function getProcesses(): RBProcess[] {
  return processes;
}

export function subscribeToProcesses(listener: ProcessListener) {
  listeners.push(listener);
  // push current state immediately
  listener([...processes]);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function upsertWindowProcess(windowId: string, appId: string, title: string) {
  const existing = processes.find((p) => p.windowId === windowId);
  const now = Date.now();

  if (existing) {
    existing.status = "running";
    existing.label = title;
    existing.lastActiveAt = now;
  } else {
    const pid = `p-${windowId}`;
    const cpu = 1 + Math.round(Math.random() * 10);
    const memory = 48 + Math.round(Math.random() * 128);

    processes.push({
      pid,
      type: "window",
      label: title,
      appId,
      windowId,
      status: "running",
      cpu,
      memory,
      startedAt: now,
      lastActiveAt: now,
    });
  }

  notify();
}

function setWindowProcessStopped(windowId: string) {
  const now = Date.now();
  let changed = false;

  processes = processes.map((p) => {
    if (p.windowId === windowId && p.status !== "stopped") {
      changed = true;
      return { ...p, status: "stopped", lastActiveAt: now };
    }
    return p;
  });

  if (changed) notify();
}

function bumpWindowActivity(windowId: string) {
  const now = Date.now();
  let changed = false;

  processes = processes.map((p) => {
    if (p.windowId === windowId && p.status === "running") {
      changed = true;
      const cpu = Math.min(100, p.cpu + 1);
      return { ...p, cpu, lastActiveAt: now };
    }
    return p;
  });

  if (changed) notify();
}

// Wire to RBEvents to build process list from window lifecycle
RBEvents.subscribe((ev) => {
  if (ev.type === "window:opened") {
    upsertWindowProcess(ev.windowId, ev.appId, ev.title);
  } else if (ev.type === "window:closed") {
    setWindowProcessStopped(ev.windowId);
  } else if (
    ev.type === "window:focused" ||
    ev.type === "window:moved" ||
    ev.type === "window:resized"
  ) {
    bumpWindowActivity(ev.windowId);
  }
});

