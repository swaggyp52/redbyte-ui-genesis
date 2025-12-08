import type { WindowState } from "./types";

/** Metadata about app types so presets can size windows intelligently */
export const APP_WEIGHTS: Record<string, "small" | "medium" | "large"> = {
  file: "medium",
  notes: "small",
  terminal: "small",
  monitor: "medium",
  logic: "large",
  cpu: "large",
  settings: "small",
};

/** Utility */
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export type PresetId =
  | "none"
  | "stack"
  | "grid"
  | "devflow"
  | "hardware"
  | "docs";

export interface PresetDefinition {
  id: PresetId;
  label: string;
  apply: (wins: WindowState[]) => WindowState[];
}

/* -------- PRESETS BELOW -------- */

const stackPreset: PresetDefinition = {
  id: "stack",
  label: "Stack Focus",
  apply: (wins) => {
    return wins.map((w, i) => ({
      ...w,
      x: 180 + i * 32,
      y: 80 + i * 28,
      width: 640,
      height: 420,
    }));
  },
};

const gridPreset: PresetDefinition = {
  id: "grid",
  label: "2×N Grid",
  apply: (wins) => {
    const margin = 16;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 40;

    const cols = 2;
    const rows = Math.ceil(wins.length / 2);

    const cellW = Math.floor((screenW - 220 - margin * (cols + 1)) / cols);
    const cellH = Math.floor((screenH - margin * (rows + 1)) / rows);

    return wins.map((w, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        ...w,
        x: 220 + margin + col * (cellW + margin),
        y: 60 + margin + row * (cellH + margin),
        width: cellW,
        height: cellH,
      };
    });
  },
};

/* -------- SMARTER, APP-AWARE PRESETS -------- */

/** Developer Workflow (Terminal big, File Explorer tall-left, Notes small) */
const devFlowPreset: PresetDefinition = {
  id: "devflow",
  label: "Developer Workflow",
  apply: (wins) => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    return wins.map((w) => {
      switch (w.appId) {
        case "terminal":
          return {
            ...w,
            x: 260,
            y: 60,
            width: screenW * 0.55,
            height: screenH * 0.55,
          };
        case "file":
          return {
            ...w,
            x: 220,
            y: 60,
            width: 250,
            height: screenH - 140,
          };
        case "notes":
          return {
            ...w,
            x: screenW * 0.6 + 40,
            y: 60,
            width: screenW * 0.28,
            height: screenH * 0.4,
          };
        default:
          return w;
      }
    });
  },
};

/** Hardware Engineering Layout (Logic + CPU front-and-center, Monitor bottom) */
const hardwarePreset: PresetDefinition = {
  id: "hardware",
  label: "Hardware Builder",
  apply: (wins) => {
    const W = window.innerWidth;
    const H = window.innerHeight;

    return wins.map((w) => {
      switch (w.appId) {
        case "logic":
          return {
            ...w,
            x: 240,
            y: 60,
            width: W * 0.5,
            height: H * 0.55,
          };
        case "cpu":
          return {
            ...w,
            x: 240 + W * 0.5 + 12,
            y: 60,
            width: W * 0.35,
            height: H * 0.55,
          };
        case "monitor":
          return {
            ...w,
            x: 240,
            y: 60 + H * 0.56,
            width: W * 0.75,
            height: H * 0.35,
          };
        default:
          return w;
      }
    });
  },
};

/** Documentation Mode (Notes big center, Files left, everything else minimized) */
const docsPreset: PresetDefinition = {
  id: "docs",
  label: "Documentation Mode",
  apply: (wins) => {
    const W = window.innerWidth;
    const H = window.innerHeight;

    return wins.map((w) => {
      switch (w.appId) {
        case "notes":
          return {
            ...w,
            x: 280,
            y: 80,
            width: W * 0.58,
            height: H * 0.78,
          };
        case "file":
          return {
            ...w,
            x: 220,
            y: 80,
            width: 240,
            height: H * 0.6,
          };
        default:
          return {
            ...w,
            width: 300,
            height: 200,
            x: W - 340,
            y: H - 260,
          };
      }
    });
  },
};

/* -------- EXPORT ALL -------- */

export const PRESETS: PresetDefinition[] = [
  { id: "none", label: "No Preset", apply: (w) => w },
  stackPreset,
  gridPreset,
  devFlowPreset,
  hardwarePreset,
  docsPreset,
];

export const getPreset = (id: PresetId): PresetDefinition =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[0];
