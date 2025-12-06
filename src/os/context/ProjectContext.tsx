import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  LogicNode,
  LogicNodeType,
  LogicTemplate,
  LogicWire,
} from "../../logic/LogicTypes";
import {
  clearStoredProject,
  loadProjectFromStorage,
  saveProjectToStorage,
} from "./ProjectSerializer";

export type CpuModuleKind =
  | "alu"
  | "register-file"
  | "control-unit"
  | "clock"
  | "memory"
  | "io";

export interface CpuModule {
  id: string;
  label: string;
  kind: CpuModuleKind;
  clockMHz: number;
}

export interface IOBus {
  id: string;
  label: string;
  width: number;
  endpoints: string[];
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSnapshot {
  ts: number;
  nodes: number;
  wires: number;
  cpuModules: number;
  buses: number;
}

export interface ProjectState {
  meta: ProjectMetadata;
  logic: LogicTemplate;
  cpuModules: CpuModule[];
  ioBuses: IOBus[];
  notes: string;
  history: ProjectSnapshot[];
}

interface ProjectContextValue {
  project: ProjectState;
  addLogicNode: (type: LogicNodeType) => void;
  removeLogicNode: (id: string) => void;
  addLogicWire: (wire: LogicWire) => void;
  removeLogicWire: (id: string) => void;
  addCpuModule: (kind: CpuModuleKind) => void;
  removeCpuModule: (id: string) => void;
  addBus: (label: string, width?: number) => void;
  removeBus: (id: string) => void;
  setName: (name: string) => void;
  setNotes: (notes: string) => void;
  resetProject: () => void;
  replaceProject: (project: ProjectState) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const demoLogicTemplate: LogicTemplate = {
  id: "demo-logic",
  name: "Demo ALU toggle",
  description: "Tiny logic slice backed by LogicTypes template data",
  nodes: [
    {
      id: "in_a",
      type: "INPUT_TOGGLE",
      label: "Input A",
      x: 1,
      y: 1,
      inputs: 0,
      outputs: 1,
    },
    {
      id: "in_b",
      type: "INPUT_TOGGLE",
      label: "Input B",
      x: 1,
      y: 3,
      inputs: 0,
      outputs: 1,
    },
    {
      id: "clock",
      type: "CLOCK",
      label: "Tick",
      x: 1,
      y: 5,
      inputs: 0,
      outputs: 1,
      meta: {
        clockPeriodTicks: 8,
      },
    },
    {
      id: "and1",
      type: "GATE_AND",
      label: "AND gate",
      x: 4,
      y: 2,
      inputs: 2,
      outputs: 1,
    },
    {
      id: "lamp",
      type: "OUTPUT_LAMP",
      label: "Lamp",
      x: 7,
      y: 2,
      inputs: 1,
      outputs: 1,
    },
  ],
  wires: [
    { id: "w1", fromNodeId: "in_a", fromIndex: 0, toNodeId: "and1", toIndex: 0 },
    { id: "w2", fromNodeId: "in_b", fromIndex: 0, toNodeId: "and1", toIndex: 1 },
    { id: "w3", fromNodeId: "and1", fromIndex: 0, toNodeId: "lamp", toIndex: 0 },
  ],
};

function createInitialProject(): ProjectState {
  const now = Date.now();
  return {
    meta: {
      id: "demo-project",
      name: "Demo CPU sandbox",
      description: "Seed design spanning logic, CPU, IO and metadata",
      createdAt: now,
      updatedAt: now,
    },
    logic: demoLogicTemplate,
    cpuModules: [
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
    ioBuses: [
      {
        id: "b1",
        label: "Main bus",
        width: 8,
        endpoints: ["u1", "u2"],
      },
    ],
    notes: "Sketch ideas, pinouts and timing plans here.",
    history: [
      {
        ts: now,
        nodes: demoLogicTemplate.nodes.length,
        wires: demoLogicTemplate.wires.length,
        cpuModules: 2,
        buses: 1,
      },
    ],
  };
}

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [project, setProject] = useState<ProjectState>(() => {
    const stored = loadProjectFromStorage();
    return stored ?? createInitialProject();
  });

  const pushSnapshot = (next: ProjectState) => {
    const snap: ProjectSnapshot = {
      ts: Date.now(),
      nodes: next.logic.nodes.length,
      wires: next.logic.wires.length,
      cpuModules: next.cpuModules.length,
      buses: next.ioBuses.length,
    };
    const history = [...next.history, snap];
    if (history.length > 64) {
      history.shift();
    }
    return { ...next, history };
  };

  const generateId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const withUpdatedMeta = (next: ProjectState): ProjectState => ({
    ...next,
    meta: { ...next.meta, updatedAt: Date.now() },
  });

  const addLogicNode = (type: LogicNodeType) => {
    setProject((prev) => {
      const id = generateId("n");
      const label = `${type.replace("GATE_", "").replace("_", " ")}`;
      const node: LogicNode = {
        id,
        type,
        label,
        x: prev.logic.nodes.length % 6,
        y: Math.floor(prev.logic.nodes.length / 6),
        inputs: type === "INPUT_TOGGLE" || type === "CLOCK" ? 0 : 2,
        outputs: 1,
        meta: type === "CLOCK" ? { clockPeriodTicks: 8 } : undefined,
      };
      const logic: LogicTemplate = {
        ...prev.logic,
        nodes: [...prev.logic.nodes, node],
      };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const removeLogicNode = (id: string) => {
    setProject((prev) => {
      const nodes = prev.logic.nodes.filter((n) => n.id !== id);
      const wires = prev.logic.wires.filter(
        (w) => w.fromNodeId !== id && w.toNodeId !== id
      );
      const logic = { ...prev.logic, nodes, wires };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const addLogicWire = (wire: LogicWire) => {
    setProject((prev) => {
      const logic = { ...prev.logic, wires: [...prev.logic.wires, wire] };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const removeLogicWire = (wireId: string) => {
    setProject((prev) => {
      const logic = {
        ...prev.logic,
        wires: prev.logic.wires.filter((w) => w.id !== wireId),
      };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const addCpuModule = (kind: CpuModuleKind) => {
    setProject((prev) => {
      const id = generateId("u");
      const unit: CpuModule = {
        id,
        label: `${kind.toUpperCase()} module`,
        kind,
        clockMHz: kind === "clock" ? 1 : 0.5,
      };
      const next = withUpdatedMeta({
        ...prev,
        cpuModules: [...prev.cpuModules, unit],
      });
      return pushSnapshot(next);
    });
  };

  const removeCpuModule = (id: string) => {
    setProject((prev) => {
      const next = withUpdatedMeta({
        ...prev,
        cpuModules: prev.cpuModules.filter((u) => u.id !== id),
      });
      return pushSnapshot(next);
    });
  };

  const addBus = (label: string, width: number = 8) => {
    setProject((prev) => {
      const bus: IOBus = {
        id: generateId("bus"),
        label,
        width,
        endpoints: [],
      };
      const next = withUpdatedMeta({ ...prev, ioBuses: [...prev.ioBuses, bus] });
      return pushSnapshot(next);
    });
  };

  const removeBus = (id: string) => {
    setProject((prev) => {
      const next = withUpdatedMeta({
        ...prev,
        ioBuses: prev.ioBuses.filter((b) => b.id !== id),
      });
      return pushSnapshot(next);
    });
  };

  const setName = (name: string) => {
    setProject((prev) =>
      pushSnapshot(
        withUpdatedMeta({
          ...prev,
          meta: { ...prev.meta, name },
        })
      )
    );
  };

  const setNotes = (notes: string) => {
    setProject((prev) => pushSnapshot(withUpdatedMeta({ ...prev, notes })));
  };

  const resetProject = () => {
    const fresh = createInitialProject();
    saveProjectToStorage(fresh);
    setProject(fresh);
  };

  const replaceProject = (next: ProjectState) => {
    saveProjectToStorage(next);
    setProject(next);
  };

  useEffect(() => {
    saveProjectToStorage(project);
  }, [project]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProject((prev) => pushSnapshot(withUpdatedMeta(prev)));
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => clearStoredProject();
  }, []);

  const value: ProjectContextValue = {
    project,
    addLogicNode,
    removeLogicNode,
    addLogicWire,
    removeLogicWire,
    addCpuModule,
    removeCpuModule,
    addBus,
    removeBus,
    setName,
    setNotes,
    resetProject,
    replaceProject,
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
