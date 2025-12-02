import type { RedstoneGrid } from "./RedstoneTypes";
import { inBounds } from "./RedstoneEngine";

export interface WatchSample {
  tick: number;
  powered: boolean;
}

export interface Watchpoint {
  id: string;
  name: string;
  x: number;
  y: number;
  history: WatchSample[];
}

const MAX_HISTORY = 64;

let watchpoints: Watchpoint[] = [];

type Listener = (wps: Watchpoint[]) => void;
const listeners: Listener[] = [];

function notify() {
  const snapshot = watchpoints.map((w) => ({
    ...w,
    history: [...w.history],
  }));
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch {
      // ignore
    }
  }
}

function genId() {
  return "w-" + Math.random().toString(16).slice(2);
}

export function getWatchpoints(): Watchpoint[] {
  return watchpoints.map((w) => ({
    ...w,
    history: [...w.history],
  }));
}

export function addWatchpoint(name: string, x: number, y: number): Watchpoint {
  // Avoid duplicate watchpoints on same coordinate
  const existing = watchpoints.find((w) => w.x === x && w.y === y);
  if (existing) {
    return existing;
  }

  const wp: Watchpoint = {
    id: genId(),
    name,
    x,
    y,
    history: [],
  };
  watchpoints.push(wp);
  notify();
  return wp;
}

export function removeWatchpoint(id: string) {
  watchpoints = watchpoints.filter((w) => w.id !== id);
  notify();
}

export function clearWatchpoints() {
  watchpoints = [];
  notify();
}

export function recordTick(grid: RedstoneGrid, tick: number) {
  if (!watchpoints.length) return;

  watchpoints = watchpoints.map((wp) => {
    let powered = false;
    if (inBounds(grid, wp.x, wp.y)) {
      const cell = grid[wp.y][wp.x];
      powered = !!(cell.powered && cell.type !== "empty");
    }
    const history = [...wp.history, { tick, powered }];
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }
    return {
      ...wp,
      history,
    };
  });

  notify();
}

export function subscribeTrace(listener: Listener) {
  listeners.push(listener);
  listener(getWatchpoints());
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
