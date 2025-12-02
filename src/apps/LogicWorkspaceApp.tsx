import React, { useEffect, useMemo, useState } from "react";
import {
  LogicSignal,
  LogicNodeType,
  LogicNode,
  LogicWire,
  LogicTemplate,
  NodeState,
  NodeStateMap,
} from "../logic/LogicTypes";
import {
  exportLogicAsJson,
  exportLogicAsVerilogModule,
} from "../logic/LogicExport";

const DEFAULT_CLOCK_PERIOD = 8;

// ------------------------------------------------------------
// Templates (examples) — incl. a tiny "CPU-ish" counter
// ------------------------------------------------------------

const TEMPLATES: LogicTemplate[] = [
  {
    id: "blank",
    name: "Blank workspace",
    description:
      "Start from an empty canvas. In future versions you will be able to add components and wires freely. For now, explore the prebuilt examples below.",
    nodes: [],
    wires: [],
  },
  {
    id: "traffic-light",
    name: "Traffic light (simple)",
    description:
      "Very simplified traffic light: one toggle is 'car present', another is 'walk requested'. Output lamps hint at basic control logic.",
    nodes: [
      {
        id: "car",
        type: "INPUT_TOGGLE",
        label: "Car present",
        x: 1,
        y: 2,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "walk",
        type: "INPUT_TOGGLE",
        label: "Walk button",
        x: 1,
        y: 4,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "clock",
        type: "CLOCK",
        label: "Cycle clock",
        x: 1,
        y: 0,
        inputs: 0,
        outputs: 1,
        meta: {
          clockPeriodTicks: 12,
        },
      },
      {
        id: "goMain",
        type: "GATE_AND",
        label: "Main green logic",
        x: 4,
        y: 1,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "goWalk",
        type: "GATE_AND",
        label: "Walk green logic",
        x: 4,
        y: 4,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "notWalk",
        type: "GATE_NOT",
        label: "No walk",
        x: 3,
        y: 3,
        inputs: 1,
        outputs: 1,
      },
      {
        id: "lampMain",
        type: "OUTPUT_LAMP",
        label: "Main green",
        x: 7,
        y: 1,
        inputs: 1,
        outputs: 1,
      },
      {
        id: "lampWalk",
        type: "OUTPUT_LAMP",
        label: "Walk green",
        x: 7,
        y: 4,
        inputs: 1,
        outputs: 1,
      },
    ],
    wires: [
      { id: "w_clock_main", fromNodeId: "clock", fromIndex: 0, toNodeId: "goMain", toIndex: 0 },
      { id: "w_clock_walk", fromNodeId: "clock", fromIndex: 0, toNodeId: "goWalk", toIndex: 0 },
      { id: "w_car_main", fromNodeId: "car", fromIndex: 0, toNodeId: "goMain", toIndex: 1 },
      { id: "w_walk_not", fromNodeId: "walk", fromIndex: 0, toNodeId: "notWalk", toIndex: 0 },
      { id: "w_not_main", fromNodeId: "notWalk", fromIndex: 0, toNodeId: "goMain", toIndex: 1 },
      { id: "w_walk_walk", fromNodeId: "walk", fromIndex: 0, toNodeId: "goWalk", toIndex: 1 },
      { id: "w_goMain_lampMain", fromNodeId: "goMain", fromIndex: 0, toNodeId: "lampMain", toIndex: 0 },
      { id: "w_goWalk_lampWalk", fromNodeId: "goWalk", fromIndex: 0, toNodeId: "lampWalk", toIndex: 0 },
    ],
  },
  {
    id: "elevator",
    name: "Elevator (2-floor)",
    description:
      "Tiny elevator brain: two request buttons and logic that decides when to move and which direction.",
    nodes: [
      {
        id: "req1",
        type: "INPUT_TOGGLE",
        label: "Request floor 1",
        x: 1,
        y: 2,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "req2",
        type: "INPUT_TOGGLE",
        label: "Request floor 2",
        x: 1,
        y: 5,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "clock",
        type: "CLOCK",
        label: "Tick",
        x: 1,
        y: 0,
        inputs: 0,
        outputs: 1,
        meta: {
          clockPeriodTicks: 10,
        },
      },
      {
        id: "goUp",
        type: "GATE_AND",
        label: "Go up?",
        x: 4,
        y: 3,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "goDown",
        type: "GATE_AND",
        label: "Go down?",
        x: 4,
        y: 6,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "lampUp",
        type: "OUTPUT_LAMP",
        label: "Up motor",
        x: 7,
        y: 3,
        inputs: 1,
        outputs: 1,
      },
      {
        id: "lampDown",
        type: "OUTPUT_LAMP",
        label: "Down motor",
        x: 7,
        y: 6,
        inputs: 1,
        outputs: 1,
      },
    ],
    wires: [
      { id: "w_clock_up", fromNodeId: "clock", fromIndex: 0, toNodeId: "goUp", toIndex: 0 },
      { id: "w_clock_down", fromNodeId: "clock", fromIndex: 0, toNodeId: "goDown", toIndex: 0 },
      { id: "w_req2_up", fromNodeId: "req2", fromIndex: 0, toNodeId: "goUp", toIndex: 1 },
      { id: "w_req1_down", fromNodeId: "req1", fromIndex: 0, toNodeId: "goDown", toIndex: 1 },
      { id: "w_up_lampUp", fromNodeId: "goUp", fromIndex: 0, toNodeId: "lampUp", toIndex: 0 },
      { id: "w_down_lampDown", fromNodeId: "goDown", fromIndex: 0, toNodeId: "lampDown", toIndex: 0 },
    ],
  },
  {
    id: "alu4",
    name: "4-bit mini-ALU (concept)",
    description:
      "Extremely simplified ALU slice: two inputs and a mode, outputs change based on basic operations.",
    nodes: [
      {
        id: "a",
        type: "INPUT_TOGGLE",
        label: "A (demo)",
        x: 1,
        y: 1,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "b",
        type: "INPUT_TOGGLE",
        label: "B (demo)",
        x: 1,
        y: 4,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "mode",
        type: "INPUT_TOGGLE",
        label: "Mode: OR / XOR (concept)",
        x: 1,
        y: 7,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "orGate",
        type: "GATE_OR",
        label: "OR",
        x: 4,
        y: 2,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "xorGate",
        type: "GATE_XOR",
        label: "XOR",
        x: 4,
        y: 5,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "lamp",
        type: "OUTPUT_LAMP",
        label: "Result bit (concept)",
        x: 7,
        y: 4,
        inputs: 1,
        outputs: 1,
      },
    ],
    wires: [
      { id: "w_a_or", fromNodeId: "a", fromIndex: 0, toNodeId: "orGate", toIndex: 0 },
      { id: "w_b_or", fromNodeId: "b", fromIndex: 0, toNodeId: "orGate", toIndex: 1 },
      { id: "w_a_xor", fromNodeId: "a", fromIndex: 0, toNodeId: "xorGate", toIndex: 0 },
      { id: "w_b_xor", fromNodeId: "b", fromIndex: 0, toNodeId: "xorGate", toIndex: 1 },
      { id: "w_or_to_lamp", fromNodeId: "orGate", fromIndex: 0, toNodeId: "lamp", toIndex: 0 },
    ],
  },
  {
    id: "cpu-counter",
    name: "Mini CPU counter (demo)",
    description:
      "Tiny CPU-ish slice: a clock and enable input feed a conceptual up-counter output lamp. This stands in for a larger CPU design.",
    nodes: [
      {
        id: "enable",
        type: "INPUT_TOGGLE",
        label: "Enable count",
        x: 1,
        y: 3,
        inputs: 0,
        outputs: 1,
      },
      {
        id: "clock",
        type: "CLOCK",
        label: "CPU clock (concept)",
        x: 1,
        y: 0,
        inputs: 0,
        outputs: 1,
        meta: {
          clockPeriodTicks: 6,
        },
      },
      {
        id: "andGate",
        type: "GATE_AND",
        label: "Clock gated by enable",
        x: 4,
        y: 2,
        inputs: 2,
        outputs: 1,
      },
      {
        id: "notGate",
        type: "GATE_NOT",
        label: "Inverted clock (demo)",
        x: 4,
        y: 5,
        inputs: 1,
        outputs: 1,
      },
      {
        id: "lamp",
        type: "OUTPUT_LAMP",
        label: "Counter active (concept)",
        x: 7,
        y: 3,
        inputs: 1,
        outputs: 1,
      },
    ],
    wires: [
      { id: "w_clock_and", fromNodeId: "clock", fromIndex: 0, toNodeId: "andGate", toIndex: 0 },
      { id: "w_enable_and", fromNodeId: "enable", fromIndex: 0, toNodeId: "andGate", toIndex: 1 },
      { id: "w_and_not", fromNodeId: "andGate", fromIndex: 0, toNodeId: "notGate", toIndex: 0 },
      { id: "w_not_lamp", fromNodeId: "notGate", fromIndex: 0, toNodeId: "lamp", toIndex: 0 },
    ],
  },
];

// ------------------------------------------------------------
// Core simulation
// ------------------------------------------------------------

function getInitialNodeState(node: LogicNode): NodeState {
  return {
    inputs: Array.from({ length: node.inputs }, () => 0 as LogicSignal),
    outputs: Array.from({ length: node.outputs }, () => {
      if (node.type === "INPUT_TOGGLE") return 0 as LogicSignal;
      if (node.type === "CLOCK") return 0 as LogicSignal;
      return "X" as LogicSignal;
    }),
    internal: {},
  };
}

function evalNodeOutputs(
  node: LogicNode,
  inputs: LogicSignal[],
  prevState: NodeState,
  globalTick: number
): NodeState {
  const next: NodeState = {
    inputs: inputs.slice(),
    outputs: prevState.outputs.slice(),
    internal: { ...(prevState.internal ?? {}) },
  };

  const getBool = (s: LogicSignal): boolean | null => {
    if (s === "X") return null;
    return s === 1;
  };

  switch (node.type) {
    case "INPUT_TOGGLE": {
      return next;
    }
    case "CLOCK": {
      const period = node.meta?.clockPeriodTicks ?? DEFAULT_CLOCK_PERIOD;
      const phase = globalTick % Math.max(1, period);
      const val: LogicSignal = phase < period / 2 ? 1 : 0;
      next.outputs[0] = val;
      return next;
    }
    case "GATE_NOT": {
      const v = getBool(inputs[0] ?? "X");
      if (v === null) next.outputs[0] = "X";
      else next.outputs[0] = v ? 0 : 1;
      return next;
    }
    case "GATE_AND": {
      const a = getBool(inputs[0] ?? "X");
      const b = getBool(inputs[1] ?? "X");
      if (a === null || b === null) next.outputs[0] = "X";
      else next.outputs[0] = a && b ? 1 : 0;
      return next;
    }
    case "GATE_OR": {
      const a = getBool(inputs[0] ?? "X");
      const b = getBool(inputs[1] ?? "X");
      if (a === null || b === null) next.outputs[0] = "X";
      else next.outputs[0] = a || b ? 1 : 0;
      return next;
    }
    case "GATE_XOR": {
      const a = getBool(inputs[0] ?? "X");
      const b = getBool(inputs[1] ?? "X");
      if (a === null || b === null) next.outputs[0] = "X";
      else next.outputs[0] = a !== b ? 1 : 0;
      return next;
    }
    case "OUTPUT_LAMP": {
      next.outputs[0] = inputs[0] ?? "X";
      return next;
    }
    default:
      return next;
  }
}

function stepSimulation(
  template: LogicTemplate,
  prevState: NodeStateMap,
  globalTick: number
): NodeStateMap {
  const nextState: NodeStateMap = {};
  for (const node of template.nodes) {
    nextState[node.id] = prevState[node.id] ?? getInitialNodeState(node);
  }

  const inputsMap: Record<string, LogicSignal[]> = {};
  for (const node of template.nodes) {
    inputsMap[node.id] = Array.from(
      { length: node.inputs },
      () => 0 as LogicSignal
    );
  }

  for (const wire of template.wires) {
    const fromNode = template.nodes.find((n) => n.id === wire.fromNodeId);
    const toNode = template.nodes.find((n) => n.id === wire.toNodeId);
    if (!fromNode || !toNode) continue;

    const fromState = nextState[fromNode.id] ?? getInitialNodeState(fromNode);
    const existing = inputsMap[toNode.id][wire.toIndex] ?? 0;
    const candidate = fromState.outputs[wire.fromIndex] ?? "X";

    if (existing === "X" || candidate === "X") {
      inputsMap[toNode.id][wire.toIndex] = "X";
    } else if (existing !== candidate) {
      inputsMap[toNode.id][wire.toIndex] = "X";
    } else {
      inputsMap[toNode.id][wire.toIndex] = candidate;
    }
  }

  for (const node of template.nodes) {
    const current = nextState[node.id] ?? getInitialNodeState(node);
    const inputs = inputsMap[node.id] ?? current.inputs;
    nextState[node.id] = evalNodeOutputs(node, inputs, current, globalTick);
  }

  return nextState;
}

// ------------------------------------------------------------
// Helpers for colors / labels
// ------------------------------------------------------------

function signalColor(signal: LogicSignal): string {
  if (signal === 1) return "#22c55e";
  if (signal === 0) return "#64748b";
  return "#eab308";
}

function signalLabel(signal: LogicSignal): string {
  if (signal === 1) return "1";
  if (signal === 0) return "0";
  return "X";
}

// ------------------------------------------------------------
// AI-style explanation: template + node-level descriptions
// ------------------------------------------------------------

function explainTemplate(template: LogicTemplate): string {
  switch (template.id) {
    case "traffic-light":
      return "This diagram represents a simplified traffic light controller. The clock advances time, the car sensor and walk button decide whether the main road or the crosswalk gets a green light.";
    case "elevator":
      return "This is a tiny controller for a 2-floor elevator. Each request button asks for a floor, and the logic decides whether the motor should move up or down.";
    case "alu4":
      return "This is a conceptual slice of an arithmetic logic unit (ALU). Two inputs A and B go through OR and XOR gates, and the mode input tells you which operation conceptually matters.";
    case "cpu-counter":
      return "This is a very small CPU-like piece: a clock and an enable signal feed gated logic that represents a counter or activity indicator.";
    default:
      return "This workspace can hold any kind of logic system: controllers, CPU slices, simple machines. Choose an example above or design your own in future versions.";
  }
}

function explainNode(node: LogicNode, template: LogicTemplate): string {
  switch (node.type) {
    case "INPUT_TOGGLE":
      return "This is an input you can turn ON or OFF. It acts like a switch or sensor in the real world.";
    case "CLOCK":
      return "This is a clock. It repeatedly flips between 0 and 1, like a heartbeat or metronome that drives the timing.";
    case "GATE_AND":
      return "AND gate: the output is 1 only when all inputs are 1. Otherwise it is 0.";
    case "GATE_OR":
      return "OR gate: the output is 1 when any input is 1. It is only 0 when all inputs are 0.";
    case "GATE_NOT":
      return "NOT gate (inverter): it flips the signal. 1 becomes 0, 0 becomes 1.";
    case "GATE_XOR":
      return "XOR gate: the output is 1 when the inputs are different, and 0 when they are the same.";
    case "OUTPUT_LAMP":
      return "This acts like an indicator light. Whatever logic feeds it decides whether the light is ON or OFF.";
    default:
      return `This node is of type ${node.type}.`;
  }
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

export function LogicWorkspaceApp() {
  const [templateId, setTemplateId] = useState<string>("traffic-light");
  const [state, setState] = useState<NodeStateMap>({});
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nlInput, setNlInput] = useState<string>("");
  const [nlStatus, setNlStatus] = useState<string>("Describe a system and I will pick a close example.");
  const [exportFormat, setExportFormat] = useState<"json" | "verilog">("json");

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );

  useEffect(() => {
    const initial: NodeStateMap = {};
    for (const node of template.nodes) {
      initial[node.id] = getInitialNodeState(node);
    }
    setState(initial);
    setTick(0);
    setSelectedNodeId(null);
  }, [template]);

  useEffect(() => {
    if (!running) return;
    if (!template.nodes.length) return;

    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setState((prev) => stepSimulation(template, prev, tick + 1));
    }, 400);

    return () => window.clearInterval(id);
  }, [running, template, tick]);

  const handleToggleInput = (nodeId: string) => {
    setState((prev) => {
      const node = template.nodes.find((n) => n.id === nodeId);
      if (!node) return prev;
      if (node.type !== "INPUT_TOGGLE") return prev;

      const curr = prev[nodeId] ?? getInitialNodeState(node);
      const next: NodeState = {
        ...curr,
        inputs: curr.inputs.slice(),
        outputs: curr.outputs.slice(),
        internal: { ...(curr.internal ?? {}) },
      };
      const currentVal = curr.outputs[0] ?? 0;
      next.outputs[0] = currentVal === 1 ? 0 : 1;

      return { ...prev, [nodeId]: next };
    });
  };

  const handleTickOnce = () => {
    if (!template.nodes.length) return;
    setTick((t) => t + 1);
    setState((prev) => stepSimulation(template, prev, tick + 1));
  };

  const handleNlGenerate = () => {
    const text = nlInput.toLowerCase();
    let target = "blank";
    if (text.includes("traffic") || text.includes("crosswalk") || text.includes("intersection")) {
      target = "traffic-light";
      setNlStatus("Matched your description to the traffic light example.");
    } else if (text.includes("elevator") || text.includes("lift")) {
      target = "elevator";
      setNlStatus("Matched your description to the elevator controller example.");
    } else if (text.includes("alu") || text.includes("bit") || text.includes("logic unit")) {
      target = "alu4";
      setNlStatus("Matched your description to the mini-ALU example.");
    } else if (text.includes("cpu") || text.includes("counter") || text.includes("clock")) {
      target = "cpu-counter";
      setNlStatus("Matched your description to the mini CPU counter example.");
    } else {
      target = "blank";
      setNlStatus("Could not match precisely; loaded a blank workspace for now.");
    }
    setTemplateId(target);
  };

  const gridSizeX = 130;
  const gridSizeY = 90;
  const padding = 40;

  const nodePixelPos = (node: LogicNode) => ({
    x: padding + node.x * gridSizeX,
    y: padding + node.y * gridSizeY,
  });

  const hoveredText = (() => {
    if (!template.nodes.length) {
      return "Pick an example from the dropdown, then toggle the blue switches.";
    }
    return "Click any box to highlight it and see a plain-language explanation on the right.";
  })();

  const selectedNode = useMemo(
    () =>
      selectedNodeId
        ? template.nodes.find((n) => n.id === selectedNodeId) ?? null
        : null,
    [selectedNodeId, template]
  );

  const templateExplanation = explainTemplate(template);
  const nodeExplanation = selectedNode
    ? explainNode(selectedNode, template)
    : "Click a component in the diagram to see what it does in simple terms.";

  const exported = useMemo(() => {
    if (exportFormat === "json") {
      return exportLogicAsJson(template);
    }
    return exportLogicAsVerilogModule(template, "redbyte_example");
  }, [exportFormat, template]);

  const hintText = (() => {
    if (!template.nodes.length) {
      return "Choose a prebuilt example from the dropdown, or describe a system in the Natural Language box.";
    }
    if (template.id === "traffic-light") {
      return "Toggle 'Car present' and 'Walk button' on and off. Watch how the two green lights change over time.";
    }
    if (template.id === "elevator") {
      return "Toggle floor request switches to see whether the Up or Down motor should run.";
    }
    if (template.id === "alu4") {
      return "Try switching A, B, and Mode to see how the result bit reacts to OR vs XOR behavior.";
    }
    if (template.id === "cpu-counter") {
      return "Turn Enable ON and see how the counter lamp responds to the CPU clock pulses.";
    }
    return "Toggle the inputs, watch colored wires change, and observe the output lamps.";
  })();

  return (
    <div className="h-full w-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Logic Workspace — 2D Diagram
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Simple diagrams for real logic. Every box is a component, every
            colored line is a signal. The right-hand side explains what&apos;s
            going on in normal language.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] text-emerald-300 font-mono">
            MODE://LOGIC-DIAGRAM
          </span>
          <span className="text-[0.65rem] text-slate-500">
            Tick: <span className="font-mono text-slate-100">{tick}</span>
          </span>
        </div>
      </header>

      {/* Top controls row */}
      <section className="rb-glass rounded-2xl px-3 py-2 border border-slate-800/80 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] text-slate-400">Example</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
              running
                ? "border-rose-500/70 text-rose-300"
                : "border-emerald-500/70 text-emerald-300"
            }`}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? "Pause" : "Run"}
          </button>
          <button
            className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-sky-500/70"
            onClick={handleTickOnce}
          >
            Step once
          </button>
        </div>

        <p className="text-[0.7rem] text-slate-400 max-w-xl">
          {template.description}
        </p>
      </section>

      {/* Middle: hint above canvas */}
      <section className="rb-glass rounded-2xl px-3 py-2 border border-slate-800/80 text-[0.7rem] text-slate-300">
        <span className="font-semibold mr-1">Tip:</span>
        {hintText}
      </section>

      {/* Main grid: left = diagram, right = AI + export */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
        {/* Left: canvas */}
        <section className="flex-1 min-h-0 rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 relative overflow-hidden">
          <div className="absolute inset-0">
            {/* Wires */}
            <svg className="w-full h-full">
              {template.wires.map((wire) => {
                const fromNode = template.nodes.find(
                  (n) => n.id === wire.fromNodeId
                );
                const toNode = template.nodes.find(
                  (n) => n.id === wire.toNodeId
                );
                if (!fromNode || !toNode) return null;

                const fromPos = nodePixelPos(fromNode);
                const toPos = nodePixelPos(toNode);

                const fromX = fromPos.x + 60;
                const fromY = fromPos.y;
                const toX = toPos.x - 60;
                const toY = toPos.y;
                const midX = (fromX + toX) / 2;

                const fromState = state[fromNode.id];
                const sig =
                  fromState?.outputs[wire.fromIndex] ?? ("X" as LogicSignal);
                const color = signalColor(sig);

                return (
                  <path
                    key={wire.id}
                    d={`M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={sig === "X" ? 0.5 : 0.9}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {template.nodes.map((node) => {
              const pos = nodePixelPos(node);
              const nodeState = state[node.id] ?? getInitialNodeState(node);
              const isInput = node.type === "INPUT_TOGGLE";
              const isOutput = node.type === "OUTPUT_LAMP";
              const selected = selectedNodeId === node.id;

              const mainColor =
                node.type === "INPUT_TOGGLE"
                  ? "#38bdf8"
                  : node.type === "CLOCK"
                  ? "#a855f7"
                  : node.type.startsWith("GATE_")
                  ? "#22c55e"
                  : "#e879f9";

              const outputVal = nodeState.outputs[0] ?? "X";

              return (
                <div
                  key={node.id}
                  className={`absolute rounded-xl border bg-slate-900/95 shadow-lg flex flex-col px-2 py-1 text-[0.7rem] cursor-pointer ${
                    selected ? "ring-2 ring-sky-500" : ""
                  }`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: "translate(-50%, -50%)",
                    borderColor: mainColor,
                    minWidth: 120,
                  }}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex flex-col">
                      <span className="text-slate-100 font-semibold">
                        {node.label}
                      </span>
                      <span className="text-[0.6rem] text-slate-500">
                        {node.type}
                      </span>
                    </div>
                    <div
                      className="h-5 w-5 rounded-full border flex items-center justify-center text-[0.6rem] font-mono"
                      style={{
                        borderColor: mainColor,
                        backgroundColor:
                          outputVal === 1
                            ? "rgba(34,197,94,0.3)"
                            : outputVal === 0
                            ? "rgba(15,23,42,0.8)"
                            : "rgba(234,179,8,0.25)",
                        color: outputVal === "X" ? "#eab308" : "#e5e7eb",
                      }}
                    >
                      {signalLabel(outputVal)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {nodeState.inputs.map((sig, idx) => (
                        <div
                          key={idx}
                          className="h-3 w-3 rounded-full border border-slate-700"
                          style={{ backgroundColor: signalColor(sig) }}
                          title={`Input ${idx}: ${signalLabel(sig)}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {nodeState.outputs.map((sig, idx) => (
                        <div
                          key={idx}
                          className="h-3 w-3 rounded-full border border-slate-700"
                          style={{ backgroundColor: signalColor(sig) }}
                          title={`Output ${idx}: ${signalLabel(sig)}`}
                        />
                      ))}
                    </div>
                  </div>

                  {isInput && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleInput(node.id);
                      }}
                      className="mt-1 px-2 py-1 rounded-lg border border-sky-500/70 text-[0.7rem] text-sky-200 hover:bg-sky-500/10"
                    >
                      Toggle: {nodeState.outputs[0] === 1 ? "ON" : "OFF"}
                    </button>
                  )}

                  {isOutput && (
                    <p className="mt-1 text-[0.65rem] text-slate-400">
                      This lamp shows the result of the logic feeding into it.
                    </p>
                  )}

                  {node.type === "CLOCK" && (
                    <p className="mt-1 text-[0.65rem] text-slate-400">
                      Clock flips between 0 and 1 over time, like a heartbeat
                      for the circuit.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.65rem] text-slate-300">
            <span className="font-semibold mr-1">Hover info:</span>
            {hoveredText}
          </div>
        </section>

        {/* Right: AI explainer + NL + export */}
        <section className="flex flex-col gap-3 rb-glass rounded-2xl border border-slate-800/80 p-3">
          {/* AI explainer */}
          <div className="rb-glass rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-100">
                Circuit explainer
              </h2>
              <span className="text-[0.65rem] text-sky-300 font-mono">
                EXPLAIN://LOCAL-V1
              </span>
            </div>
            <p className="text-[0.7rem] text-slate-300">
              {templateExplanation}
            </p>
            <div className="mt-2 border-t border-slate-800/80 pt-2">
              <p className="text-[0.7rem] text-slate-400 mb-1">
                {selectedNode
                  ? `About “${selectedNode.label}”:`
                  : "Click a component in the diagram to learn what it does."}
              </p>
              <p className="text-[0.7rem] text-slate-300">
                {nodeExplanation}
              </p>
            </div>
          </div>

          {/* Natural language designer */}
          <div className="rb-glass rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-100">
                Natural language designer
              </h2>
              <span className="text-[0.65rem] text-emerald-300 font-mono">
                DESIGN://TEXT→LOGIC
              </span>
            </div>
            <p className="text-[0.7rem] text-slate-400">
              Type what you want to simulate (e.g. “traffic light for cars and
              pedestrians”) and I&apos;ll pick the closest built-in example.
            </p>
            <textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              className="mt-1 w-full min-h-[3.5rem] rounded-xl bg-slate-950/80 border border-slate-700/80 px-2 py-1 text-[0.7rem] text-slate-100"
              placeholder="Example: a simple elevator controller with two floors"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleNlGenerate}
                className="px-2 py-1 rounded-xl border border-emerald-500/70 text-[0.7rem] text-emerald-200 hover:bg-emerald-500/10"
              >
                Generate diagram
              </button>
              <p className="text-[0.65rem] text-slate-400 text-right">
                {nlStatus}
              </p>
            </div>
          </div>

          {/* Export panel */}
          <div className="rb-glass rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-2 flex-1 min-h-[6rem]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-100">
                Export circuit
              </h2>
              <span className="text-[0.65rem] text-fuchsia-300 font-mono">
                EXPORT://JSON+HDL
              </span>
            </div>
            <div className="flex items-center gap-2 text-[0.7rem]">
              <span className="text-slate-400">Format</span>
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as "json" | "verilog")
                }
                className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100"
              >
                <option value="json">JSON</option>
                <option value="verilog">Verilog-style</option>
              </select>
            </div>
            <textarea
              readOnly
              value={exported}
              className="flex-1 min-h-[5rem] mt-1 w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-2 py-1 text-[0.65rem] font-mono text-slate-100"
            />
            <p className="text-[0.65rem] text-slate-400">
              You can copy this text into documentation, assignments, or other
              tools. In future versions, this export will be suitable for real
              hardware design flows.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LogicWorkspaceApp;






























