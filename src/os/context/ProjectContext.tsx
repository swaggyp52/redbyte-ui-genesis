import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type LogicGateKind =
  | "and"
  | "or"
  | "not"
  | "nand"
  | "nor"
  | "xor"
  | "xnor";

export type CpuUnitKind =
  | "alu"
  | "register-file"
  | "control-unit"
  | "clock"
  | "memory"
  | "io";

export interface LogicGate {
  id: string;
  label: string;
  kind: LogicGateKind;
  inputs: number;
  outputs: number;
}

export interface CpuUnit {
  id: string;
  label: string;
  kind: CpuUnitKind;
  clockMHz: number;
}

export interface ProjectSnapshot {
  ts: number;
  gates: number;
  units: number;
}

export interface ProjectState {
  id: string;
  name: string;
  createdAt: number;
  logicGates: LogicGate[];
  cpuUnits: CpuUnit[];
  history: ProjectSnapshot[];
}

interface ProjectContextValue {
  project: ProjectState;
  addGate: (kind: LogicGateKind) => void;
  addCpuUnit: (kind: CpuUnitKind) => void;
  removeGate: (id: string) => void;
  removeCpuUnit: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined
);

function createInitialProject(): ProjectState {
  const now = Date.now();
  return {
    id: "demo-project",
    name: "Demo CPU sandbox",
    createdAt: now,
    logicGates: [
      {
        id: "g1",
        label: "AND gate",
        kind: "and",
        inputs: 2,
        outputs: 1,
      },
      {
        id: "g2",
        label: "NOT gate",
        kind: "not",
        inputs: 1,
        outputs: 1,
      },
    ],
    cpuUnits: [
      {
        id: "u1",
        label: "ALU core",
        kind: "alu",
        clockMHz: 1,
      },
      {
        id: "u2",
        label: "Register file",
        kind: "register-file",
        clockMHz: 1,
      },
    ],
    history: [
      {
        ts: now,
        gates: 2,
        units: 2,
      },
    ],
  };
}

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [project, setProject] = useState<ProjectState>(() =>
    createInitialProject()
  );

  const pushSnapshot = (next: ProjectState) => {
    const snap: ProjectSnapshot = {
      ts: Date.now(),
      gates: next.logicGates.length,
      units: next.cpuUnits.length,
    };
    const history = [...next.history, snap];
    if (history.length > 64) {
      history.shift();
    }
    return { ...next, history };
  };

  const addGate = (kind: LogicGateKind) => {
    setProject((prev) => {
      const id = `g-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const baseInputs = kind === "not" ? 1 : 2;
      const gate: LogicGate = {
        id,
        label: `${kind.toUpperCase()} gate`,
        kind,
        inputs: baseInputs,
        outputs: 1,
      };
      const next: ProjectState = {
        ...prev,
        logicGates: [...prev.logicGates, gate],
      };
      return pushSnapshot(next);
    });
  };

  const addCpuUnit = (kind: CpuUnitKind) => {
    setProject((prev) => {
      const id = `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const unit: CpuUnit = {
        id,
        label: `${kind.toUpperCase()} unit`,
        kind,
        clockMHz: kind === "clock" ? 1 : 0.5,
      };
      const next: ProjectState = {
        ...prev,
        cpuUnits: [...prev.cpuUnits, unit],
      };
      return pushSnapshot(next);
    });
  };

  const removeGate = (id: string) => {
    setProject((prev) => {
      const next: ProjectState = {
        ...prev,
        logicGates: prev.logicGates.filter((g) => g.id !== id),
      };
      return pushSnapshot(next);
    });
  };

  const removeCpuUnit = (id: string) => {
    setProject((prev) => {
      const next: ProjectState = {
        ...prev,
        cpuUnits: prev.cpuUnits.filter((u) => u.id !== id),
      };
      return pushSnapshot(next);
    });
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProject((prev) => pushSnapshot(prev));
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const value: ProjectContextValue = {
    project,
    addGate,
    addCpuUnit,
    removeGate,
    removeCpuUnit,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used inside ProjectProvider");
  }
  return ctx;
}
