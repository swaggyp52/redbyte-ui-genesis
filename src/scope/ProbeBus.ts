import type { VoxelBlock } from "../world3d/VoxelWorld";
import { subscribeSimHistory } from "../world3d/SimMetrics";
import { getVoxel } from "../world3d/VoxelWorld";

export interface ProbeDef {
  id: string;
  label: string;
  mode: "voxel" | "grid2d";
  x: number;
  y: number;
  z?: number;
  visible: boolean;
}

export interface ProbeSample {
  probeId: string;
  tick: number;
  high: boolean;
}

const MAX_HISTORY = 512;

let probes: ProbeDef[] = [];
let listeners: ((all: ProbeSample[]) => void)[] = [];

let history: ProbeSample[] = [];

function notify() {
  const snap = history.map((h) => ({ ...h }));
  for (const l of listeners) {
    try {
      l(snap);
    } catch {}
  }
}

export function getProbes(): ProbeDef[] {
  return probes.map((p) => ({ ...p }));
}

export function addProbe(def: ProbeDef) {
  probes.push({ ...def });
}

export function removeProbe(id: string) {
  probes = probes.filter((p) => p.id !== id);
}

export function toggleProbeVisibility(id: string) {
  probes = probes.map((p) =>
    p.id === id ? { ...p, visible: !p.visible } : p
  );
}

export function subscribeProbeSamples(
  listener: (all: ProbeSample[]) => void
) {
  listeners.push(listener);
  listener(history);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

subscribeSimHistory((sim) => {
  if (!sim.length) return;
  const last = sim[sim.length - 1];

  for (const p of probes) {
    let isHigh = false;

    if (p.mode === "voxel") {
      const b = getVoxel(p.x, p.y, p.z ?? 0);
      isHigh = !!b?.powered;
    }

    // 2D mode stub (future upgrade)
    if (p.mode === "grid2d") {
      isHigh = false;
    }

    history.push({
      probeId: p.id,
      tick: last.tick,
      high: isHigh,
    });
  }

  if (history.length > MAX_HISTORY) {
    history = history.slice(history.length - MAX_HISTORY);
  }

  notify();
});
