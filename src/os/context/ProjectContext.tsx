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
  LogicNet,
} from "../../logic/LogicTypes";
import {
  loadProjectFromStorage,
  saveProjectToStorage,
} from "./ProjectSerializer";
import {
  CpuModule,
  CpuModuleKind,
  CpuBus,
  ProjectClock,
  ProjectIOPin,
  ProjectIODirection,
  ProjectState,
  ProjectSnapshot,
  LogicTimingProfile,
  ProjectSignalWatch,
} from "./ProjectTypes";

export type {
  CpuModuleKind,
  ProjectState,
  ProjectClock,
  ProjectIOPin,
  ProjectSignalWatch,
} from "./ProjectTypes";

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
  addIoPin: (direction: ProjectIODirection, label?: string, width?: number) => void;
  removeIoPin: (id: string) => void;
  addClock: (label?: string, hz?: number, netId?: string) => void;
  removeClock: (id: string) => void;
  updateTiming: (timing: Partial<LogicTimingProfile>) => void;
  addSignalWatch: (watch: Partial<ProjectSignalWatch>) => void;
  removeSignalWatch: (id: string) => void;
  toggleSignalWatchVisibility: (id: string) => void;
  updateSignalWatchLayer: (id: string, layer: number) => void;
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
    { id: "w4", fromNodeId: "clock", fromIndex: 0, toNodeId: "lamp", toIndex: 0 },
  ],
};

const demoNets: LogicNet[] = [
  {
    id: "net_a",
    label: "A",
    connections: [
      { nodeId: "in_a", portIndex: 0, direction: "out", wireId: "w1" },
      { nodeId: "and1", portIndex: 0, direction: "in", wireId: "w1" },
    ],
  },
  {
    id: "net_b",
    label: "B",
    connections: [
      { nodeId: "in_b", portIndex: 0, direction: "out", wireId: "w2" },
      { nodeId: "and1", portIndex: 1, direction: "in", wireId: "w2" },
    ],
  },
  {
    id: "net_out",
    label: "Lamp output",
    connections: [
      { nodeId: "and1", portIndex: 0, direction: "out", wireId: "w3" },
      { nodeId: "lamp", portIndex: 0, direction: "in", wireId: "w3" },
    ],
  },
  {
    id: "net_clock",
    label: "Clock",
    connections: [
      { nodeId: "clock", portIndex: 0, direction: "out", wireId: "w4" },
      { nodeId: "lamp", portIndex: 0, direction: "in", wireId: "w4" },
    ],
  },
];

const demoIoPins: ProjectIOPin[] = [
  {
    id: "pin_a",
    label: "IN_A",
    direction: "input",
    width: 1,
    netId: "net_a",
    attachedNodeId: "in_a",
  },
  {
    id: "pin_b",
    label: "IN_B",
    direction: "input",
    width: 1,
    netId: "net_b",
    attachedNodeId: "in_b",
  },
  {
    id: "pin_out",
    label: "OUT",
    direction: "output",
    width: 1,
    netId: "net_out",
    attachedNodeId: "lamp",
  },
];

const demoClocks: ProjectClock[] = [
  {
    id: "clk_main",
    label: "Main clock",
    hz: 1,
    dutyCycle: 0.5,
    netId: "net_clock",
  },
];

const demoSignalWatches: ProjectSignalWatch[] = [
  {
    id: "watch_out",
    label: "Lamp output",
    nodeId: "lamp",
    layer: 0,
    visible: true,
  },
];

const demoTiming: LogicTimingProfile = {
  baseClockHz: 1,
  tickIntervalMs: 250,
  propagationDelayNs: 50,
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
      tags: ["demo", "sandbox"],
      version: 2,
    },
    logic: {
      template: demoLogicTemplate,
      nets: demoNets,
      ioPins: demoIoPins,
      clocks: demoClocks,
      timing: demoTiming,
    },
    cpu: {
      units: [
        {
          id: "u1",
          label: "ALU core",
          kind: "alu",
          clockHz: 1,
          attachedNets: ["net_a", "net_b", "net_out"],
          description: "8-bit arithmetic and logical unit",
        },
        {
          id: "u2",
          label: "Register file",
          kind: "register-file",
          clockHz: 1,
          attachedNets: ["net_out"],
        },
      ],
      buses: [
        {
          id: "b1",
          label: "Main bus",
          width: 8,
          endpoints: ["u1", "u2"],
        },
      ],
    },
    signal: { watches: demoSignalWatches },
    notes: "Sketch ideas, pinouts and timing plans here.",
    history: [
      {
        ts: now,
        logicNodes: demoLogicTemplate.nodes.length,
        logicWires: demoLogicTemplate.wires.length,
        logicNets: demoNets.length,
        cpuUnits: 2,
        buses: 1,
        ioPins: demoIoPins.length,
        clocks: demoClocks.length,
      },
    ],
  };
}

function ensureSignalModel(project: ProjectState): ProjectState {
  if (project.signal && Array.isArray(project.signal.watches)) return project;
  return {
    ...project,
    signal: { watches: [] },
  };
}

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [project, setProject] = useState<ProjectState>(() => {
    const stored = loadProjectFromStorage();
    return ensureSignalModel(stored ?? createInitialProject());
  });

  const generateId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const pushSnapshot = (next: ProjectState) => {
    const snap: ProjectSnapshot = {
      ts: Date.now(),
      logicNodes: next.logic.template.nodes.length,
      logicWires: next.logic.template.wires.length,
      logicNets: next.logic.nets.length,
      cpuUnits: next.cpu.units.length,
      buses: next.cpu.buses.length,
      ioPins: next.logic.ioPins.length,
      clocks: next.logic.clocks.length,
    };
    const history = [...next.history, snap];
    if (history.length > 64) history.shift();
    return { ...next, history };
  };

  const withUpdatedMeta = (next: ProjectState): ProjectState => ({
    ...next,
    meta: { ...next.meta, updatedAt: Date.now() },
  });

  const pruneNets = (nets: LogicNet[], nodeId: string): LogicNet[] =>
    nets
      .map((net) => ({
        ...net,
        connections: net.connections.filter((c) => c.nodeId !== nodeId),
      }))
      .filter((net) => net.connections.length > 0);

  const pruneConnectionsForWire = (nets: LogicNet[], wireId: string) =>
    nets
      .map((net) => ({
        ...net,
        connections: net.connections.filter((c) => c.wireId !== wireId),
      }))
      .filter((net) => net.connections.length > 0);

  const addLogicNode = (type: LogicNodeType) => {
    setProject((prev) => {
      const id = generateId("n");
      const label = `${type.replace("GATE_", "").replace("_", " ")}`;
      const node: LogicNode = {
        id,
        type,
        label,
        x: prev.logic.template.nodes.length % 6,
        y: Math.floor(prev.logic.template.nodes.length / 6),
        inputs: type === "INPUT_TOGGLE" || type === "CLOCK" ? 0 : 2,
        outputs: 1,
        meta: type === "CLOCK" ? { clockPeriodTicks: 8 } : undefined,
      };
      const template: LogicTemplate = {
        ...prev.logic.template,
        nodes: [...prev.logic.template.nodes, node],
      };
      const logic = { ...prev.logic, template };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const removeLogicNode = (id: string) => {
    setProject((prev) => {
      const nodes = prev.logic.template.nodes.filter((n) => n.id !== id);
      const wires = prev.logic.template.wires.filter(
        (w) => w.fromNodeId !== id && w.toNodeId !== id
      );
      const nets = pruneNets(prev.logic.nets, id);
      const template = { ...prev.logic.template, nodes, wires };
      const logic = { ...prev.logic, template, nets };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const addLogicWire = (wire: LogicWire) => {
    setProject((prev) => {
      const template = {
        ...prev.logic.template,
        wires: [...prev.logic.template.wires, wire],
      };
      const net: LogicNet = {
        id: generateId("net"),
        label: `Net ${prev.logic.nets.length + 1}`,
        connections: [
          {
            nodeId: wire.fromNodeId,
            portIndex: wire.fromIndex,
            direction: "out",
            wireId: wire.id,
          },
          {
            nodeId: wire.toNodeId,
            portIndex: wire.toIndex,
            direction: "in",
            wireId: wire.id,
          },
        ],
      };
      const logic = { ...prev.logic, template, nets: [...prev.logic.nets, net] };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const removeLogicWire = (wireId: string) => {
    setProject((prev) => {
      const template = {
        ...prev.logic.template,
        wires: prev.logic.template.wires.filter((w) => w.id !== wireId),
      };
      const nets = pruneConnectionsForWire(prev.logic.nets, wireId);
      const logic = { ...prev.logic, template, nets };
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
        clockHz: kind === "clock" ? 1 : 0.5,
      };
      const next = withUpdatedMeta({
        ...prev,
        cpu: { ...prev.cpu, units: [...prev.cpu.units, unit] },
      });
      return pushSnapshot(next);
    });
  };

  const removeCpuModule = (id: string) => {
    setProject((prev) => {
      const next = withUpdatedMeta({
        ...prev,
        cpu: { ...prev.cpu, units: prev.cpu.units.filter((u) => u.id !== id) },
      });
      return pushSnapshot(next);
    });
  };

  const addBus = (label: string, width: number = 8) => {
    setProject((prev) => {
      const bus: CpuBus = {
        id: generateId("bus"),
        label,
        width,
        endpoints: [],
      };
      const next = withUpdatedMeta({
        ...prev,
        cpu: { ...prev.cpu, buses: [...prev.cpu.buses, bus] },
      });
      return pushSnapshot(next);
    });
  };

  const removeBus = (id: string) => {
    setProject((prev) => {
      const next = withUpdatedMeta({
        ...prev,
        cpu: { ...prev.cpu, buses: prev.cpu.buses.filter((b) => b.id !== id) },
      });
      return pushSnapshot(next);
    });
  };

  const addIoPin = (
    direction: ProjectIODirection,
    label: string = direction === "input" ? "IN" : "OUT",
    width: number = 1
  ) => {
    setProject((prev) => {
      const ioPin: ProjectIOPin = {
        id: generateId("pin"),
        label,
        direction,
        width,
      };
      const logic = { ...prev.logic, ioPins: [...prev.logic.ioPins, ioPin] };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const removeIoPin = (id: string) => {
    setProject((prev) => {
      const logic = {
        ...prev.logic,
        ioPins: prev.logic.ioPins.filter((pin) => pin.id !== id),
      };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const addClock = (label: string = "Clock", hz: number = 1, netId?: string) => {
    setProject((prev) => {
      const clock: ProjectClock = {
        id: generateId("clk"),
        label,
        hz,
        dutyCycle: 0.5,
        netId,
      };
      const logic = { ...prev.logic, clocks: [...prev.logic.clocks, clock] };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const removeClock = (id: string) => {
    setProject((prev) => {
      const logic = {
        ...prev.logic,
        clocks: prev.logic.clocks.filter((clk) => clk.id !== id),
      };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const updateTiming = (timing: Partial<LogicTimingProfile>) => {
    setProject((prev) => {
      const logic = {
        ...prev.logic,
        timing: { ...prev.logic.timing, ...timing },
      };
      const next = withUpdatedMeta({ ...prev, logic });
      return pushSnapshot(next);
    });
  };

  const addSignalWatch = (watch: Partial<ProjectSignalWatch>) => {
    setProject((prev) => {
      const id = watch.id ?? generateId("watch");
      const nextWatch: ProjectSignalWatch = {
        id,
        label: watch.label ?? watch.nodeId ?? watch.netId ?? `Watch ${prev.signal.watches.length + 1}`,
        nodeId: watch.nodeId,
        netId: watch.netId,
        layer: watch.layer ?? 0,
        pinnedPosition: watch.pinnedPosition,
        visible: watch.visible ?? true,
      };
      const signal = {
        ...prev.signal,
        watches: [...prev.signal.watches, nextWatch],
      };
      const next = withUpdatedMeta({ ...prev, signal });
      return pushSnapshot(next);
    });
  };

  const removeSignalWatch = (id: string) => {
    setProject((prev) => {
      const signal = {
        ...prev.signal,
        watches: prev.signal.watches.filter((w) => w.id !== id),
      };
      const next = withUpdatedMeta({ ...prev, signal });
      return pushSnapshot(next);
    });
  };

  const toggleSignalWatchVisibility = (id: string) => {
    setProject((prev) => {
      const signal = {
        ...prev.signal,
        watches: prev.signal.watches.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w
        ),
      };
      const next = withUpdatedMeta({ ...prev, signal });
      return pushSnapshot(next);
    });
  };

  const updateSignalWatchLayer = (id: string, layer: number) => {
    setProject((prev) => {
      const signal = {
        ...prev.signal,
        watches: prev.signal.watches.map((w) =>
          w.id === id ? { ...w, layer } : w
        ),
      };
      const next = withUpdatedMeta({ ...prev, signal });
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
    const normalized = ensureSignalModel(next);
    saveProjectToStorage(normalized);
    setProject(normalized);
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
    addIoPin,
    removeIoPin,
    addClock,
    removeClock,
    updateTiming,
    addSignalWatch,
    removeSignalWatch,
    toggleSignalWatchVisibility,
    updateSignalWatchLayer,
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
