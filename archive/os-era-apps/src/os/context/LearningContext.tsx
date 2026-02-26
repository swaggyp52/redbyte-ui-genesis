import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useProject } from "./ProjectContext";

export interface LearningStep {
  id: string;
  title: string;
  description: string;
  targetApp: string;
  hint: string;
}

interface LearningContextValue {
  steps: LearningStep[];
  completed: Set<string>;
  activeStepId: string;
  completeStep: (id: string) => void;
  resetLearning: () => void;
}

const defaultSteps: LearningStep[] = [
  {
    id: "build-and-gate",
    title: "Build a 2-input AND gate",
    description:
      "Drop in two input toggles, an AND gate, and a lamp output. Wire A and B into the gate, then the gate into the lamp to see a truth table emerge.",
    targetApp: "Logic Designer",
    hint:
      "Propagate signals from inputs → gate → lamp; clocks can drive time-based behaviors for later steps.",
  },
  {
    id: "view-in-3d",
    title: "View it in 3D",
    description:
      "Open the 3D simulator, rebuild the mapping, and orbit around the voxel redstone layout of your circuit.",
    targetApp: "3D Viewer",
    hint:
      "Each logic node maps to a voxel cluster; wires become dust trails. Use the layer slider to slice vertically.",
  },
  {
    id: "inspect-timing",
    title: "Inspect timing",
    description:
      "Add a probe in Signal Scope for the lamp output (or any watched node) and watch the waveform tick when inputs change.",
    targetApp: "Signal Scope",
    hint:
      "Waveforms show propagation; toggling inputs will push edges through nets and clocks per your timing profile.",
  },
  {
    id: "view-code",
    title: "View code representation",
    description:
      "Export the circuit as JSON, Verilog-style text, or a redstone block list to compare models.",
    targetApp: "Code View",
    hint:
      "These exports reflect the same project model that the 3D view and scope consume.",
  },
];

const LEARNING_STORAGE_KEY = "redbyte-learning-progress";

const LearningContext = createContext<LearningContextValue | undefined>(undefined);

const loadProgress = () => {
  try {
    const raw = localStorage.getItem(LEARNING_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
};

const persistProgress = (completed: Set<string>) => {
  try {
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(Array.from(completed)));
  } catch {
    // ignore persistence errors silently
  }
};

export const LearningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { project } = useProject();
  const [completed, setCompleted] = useState<Set<string>>(loadProgress);

  const activeStepId = useMemo(() => {
    const firstIncomplete = defaultSteps.find((step) => !completed.has(step.id));
    return firstIncomplete?.id ?? defaultSteps[defaultSteps.length - 1].id;
  }, [completed]);

  const completeStep = (id: string) => {
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistProgress(next);
      return next;
    });
  };

  const resetLearning = () => {
    const empty = new Set<string>();
    setCompleted(empty);
    persistProgress(empty);
  };

  useEffect(() => {
    const hasAndGate = project.logic.template.nodes.some((n) => n.type === "GATE_AND");
    if (hasAndGate) completeStep("build-and-gate");

    if (project.signal.watches.length > 0) completeStep("inspect-timing");
  }, [project.logic.template.nodes, project.signal.watches]);

  return (
    <LearningContext.Provider
      value={{ steps: defaultSteps, completed, activeStepId, completeStep, resetLearning }}
    >
      {children}
    </LearningContext.Provider>
  );
};

export const useLearning = (): LearningContextValue => {
  const ctx = useContext(LearningContext);
  if (!ctx) {
    throw new Error("useLearning must be used within LearningProvider");
  }
  return ctx;
};

