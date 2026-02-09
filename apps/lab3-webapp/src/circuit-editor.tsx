import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLabStore } from './store';
import { Zap, Trash2, Save, Undo, Redo, Plus, Play, Square } from 'lucide-react';

// Gate types
export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'INPUT' | 'OUTPUT';

export interface Gate {
  id: string;
  type: GateType;
  x: number;
  y: number;
  inputs: number; // Number of input pins
  label?: string;
  value?: boolean; // For INPUT gates or propagated values
}

export interface Wire {
  id: string;
  from: { gateId: string; pin: number }; // pin = 0 for output, 1+ for inputs
  to: { gateId: string; pin: number };
}

export interface CircuitState {
  gates: Gate[];
  wires: Wire[];
  nextId: number;
}

const GATE_WIDTH = 80;
const GATE_HEIGHT = 60;
const PIN_RADIUS = 6;
const GRID_SIZE = 20;

const GATE_COLORS: Record<GateType, { fill: string; stroke: string; glow: string }> = {
  AND: { fill: '#0f766e', stroke: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)' },
  OR: { fill: '#0e7490', stroke: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
  NOT: { fill: '#7c2d12', stroke: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
  NAND: { fill: '#581c87', stroke: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  NOR: { fill: '#1e3a8a', stroke: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  XOR: { fill: '#4c1d95', stroke: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },
  XNOR: { fill: '#701a75', stroke: '#d946ef', glow: 'rgba(217, 70, 239, 0.4)' },
  INPUT: { fill: '#065f46', stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  OUTPUT: { fill: '#991b1b', stroke: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
};

export const CircuitEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [circuit, setCircuit] = useState<CircuitState>({
    gates: [],
    wires: [],
    nextId: 0,
  });

  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ gateId: string; offsetX: number; offsetY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ gateId: string; pin: number } | null>(null);
  const [hoveredPin, setHoveredPin] = useState<{ gateId: string; pin: number; isOutput: boolean } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<CircuitState[]>([circuit]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Draw the circuit
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x + panOffset.x, 0);
      ctx.lineTo(x + panOffset.x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y + panOffset.y);
      ctx.lineTo(canvas.width, y + panOffset.y);
      ctx.stroke();
    }

    // Draw wires
    circuit.wires.forEach(wire => {
      const fromGate = circuit.gates.find(g => g.id === wire.from.gateId);
      const toGate = circuit.gates.find(g => g.id === wire.to.gateId);
      if (!fromGate || !toGate) return;

      const fromPos = getOutputPinPosition(fromGate);
      const toPos = getInputPinPosition(toGate, wire.to.pin);

      // Check if wire is active (source gate has value)
      const isActive = fromGate.value === true;

      ctx.strokeStyle = isActive ? '#10b981' : '#475569';
      ctx.lineWidth = 3;
      ctx.shadowBlur = isActive ? 10 : 0;
      ctx.shadowColor = isActive ? '#10b981' : 'transparent';

      // Draw curved wire
      ctx.beginPath();
      ctx.moveTo(fromPos.x + panOffset.x, fromPos.y + panOffset.y);
      const midX = (fromPos.x + toPos.x) / 2;
      ctx.bezierCurveTo(
        midX + panOffset.x, fromPos.y + panOffset.y,
        midX + panOffset.x, toPos.y + panOffset.y,
        toPos.x + panOffset.x, toPos.y + panOffset.y
      );
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Draw gates
    circuit.gates.forEach(gate => {
      drawGate(ctx, gate, gate.id === selectedGate);
    });

    // Draw connecting wire preview
    if (connecting) {
      const gate = circuit.gates.find(g => g.id === connecting.gateId);
      if (gate) {
        const startPos = getOutputPinPosition(gate);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startPos.x + panOffset.x, startPos.y + panOffset.y);
        // Draw to mouse position (would need mouse tracking)
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [circuit, panOffset, zoom, selectedGate, connecting]);

  const drawGate = (ctx: CanvasRenderingContext2D, gate: Gate, isSelected: boolean) => {
    const colors = GATE_COLORS[gate.type];
    const x = gate.x + panOffset.x;
    const y = gate.y + panOffset.y;

    // Draw gate body
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = isSelected ? 3 : 2;

    if (isSelected) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = colors.glow;
    }

    // Draw different shapes based on gate type
    if (gate.type === 'NOT') {
      // Triangle with circle
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + GATE_WIDTH - 10, y + GATE_HEIGHT / 2);
      ctx.lineTo(x, y + GATE_HEIGHT);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inverter bubble
      ctx.beginPath();
      ctx.arc(x + GATE_WIDTH - 5, y + GATE_HEIGHT / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Rectangle for other gates
      ctx.fillRect(x, y, GATE_WIDTH, GATE_HEIGHT);
      ctx.strokeRect(x, y, GATE_WIDTH, GATE_HEIGHT);
    }

    ctx.shadowBlur = 0;

    // Draw label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px "Orbitron", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gate.label || gate.type, x + GATE_WIDTH / 2, y + GATE_HEIGHT / 2);

    // Draw input pins
    const inputCount = gate.type === 'NOT' ? 1 : gate.type === 'OUTPUT' ? 1 : 2;
    for (let i = 0; i < inputCount; i++) {
      const pinY = y + (GATE_HEIGHT / (inputCount + 1)) * (i + 1);
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(x, pinY, PIN_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw output pin (not for OUTPUT gates)
    if (gate.type !== 'OUTPUT') {
      ctx.fillStyle = gate.value ? '#10b981' : '#475569';
      ctx.strokeStyle = gate.value ? '#10b981' : '#94a3b8';
      if (gate.value) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#10b981';
      }
      ctx.beginPath();
      ctx.arc(x + GATE_WIDTH, y + GATE_HEIGHT / 2, PIN_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  const getOutputPinPosition = (gate: Gate) => ({
    x: gate.x + GATE_WIDTH,
    y: gate.y + GATE_HEIGHT / 2,
  });

  const getInputPinPosition = (gate: Gate, pinIndex: number) => {
    const inputCount = gate.type === 'NOT' ? 1 : gate.type === 'OUTPUT' ? 1 : 2;
    const pinY = gate.y + (GATE_HEIGHT / (inputCount + 1)) * (pinIndex + 1);
    return { x: gate.x, y: pinY };
  };

  const addGate = (type: GateType) => {
    const newGate: Gate = {
      id: `gate_${circuit.nextId}`,
      type,
      x: 100 + circuit.nextId * 20,
      y: 100 + circuit.nextId * 20,
      inputs: type === 'NOT' ? 1 : 2,
      label: type === 'INPUT' ? `SW${circuit.gates.filter(g => g.type === 'INPUT').length}` : undefined,
      value: type === 'INPUT' ? false : undefined,
    };

    const newCircuit = {
      ...circuit,
      gates: [...circuit.gates, newGate],
      nextId: circuit.nextId + 1,
    };

    setCircuit(newCircuit);
    addToHistory(newCircuit);
  };

  const deleteGate = (gateId: string) => {
    const newCircuit = {
      ...circuit,
      gates: circuit.gates.filter(g => g.id !== gateId),
      wires: circuit.wires.filter(w => w.from.gateId !== gateId && w.to.gateId !== gateId),
    };
    setCircuit(newCircuit);
    addToHistory(newCircuit);
    setSelectedGate(null);
  };

  const addToHistory = (newCircuit: CircuitState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCircuit);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCircuit(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCircuit(history[historyIndex + 1]);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - panOffset.x;
    const y = e.clientY - rect.top - panOffset.y;

    // Check if clicked on a gate
    const clickedGate = circuit.gates.find(gate =>
      x >= gate.x && x <= gate.x + GATE_WIDTH &&
      y >= gate.y && y <= gate.y + GATE_HEIGHT
    );

    if (clickedGate) {
      if (clickedGate.type === 'INPUT') {
        // Toggle input value
        const newCircuit = {
          ...circuit,
          gates: circuit.gates.map(g =>
            g.id === clickedGate.id ? { ...g, value: !g.value } : g
          ),
        };
        setCircuit(newCircuit);
        propagateSignals(newCircuit);
      }
      setSelectedGate(clickedGate.id);
    } else {
      setSelectedGate(null);
    }
  };

  const propagateSignals = (circuitState: CircuitState) => {
    // Full signal propagation algorithm
    const updatedGates = circuitState.gates.map(g => ({ ...g, value: g.type === 'INPUT' ? g.value : undefined }));
    const gateMap = new Map(updatedGates.map(g => [g.id, g]));
    
    // Build adjacency list for propagation
    const wireMap = new Map<string, { gateId: string; pin: number }[]>();
    circuitState.wires.forEach(wire => {
      const list = wireMap.get(wire.from.gateId) || [];
      list.push(wire.to);
      wireMap.set(wire.from.gateId, list);
    });

    // Topological traversal with BFS from INPUT gates
    const queue: string[] = [];
    const visited = new Set<string>();
    const inputGates = updatedGates.filter(g => g.type === 'INPUT');
    inputGates.forEach(g => queue.push(g.id));

    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (queue.length > 0 && iterations++ < maxIterations) {
      const gateId = queue.shift()!;
      if (visited.has(gateId)) continue;
      visited.add(gateId);

      const gate = gateMap.get(gateId);
      if (!gate) continue;

      // Propagate to connected gates
      const targets = wireMap.get(gateId) || [];
      targets.forEach(target => {
        const targetGate = gateMap.get(target.gateId);
        if (!targetGate) return;

        // Get all input values for target gate
        const inputWires = circuitState.wires.filter(w => w.to.gateId === target.gateId);
        const inputValues = inputWires.map(w => {
          const sourceGate = gateMap.get(w.from.gateId);
          return sourceGate?.value === true;
        });

        // Calculate gate output based on type
        let output: boolean | undefined;
        
        switch (targetGate.type) {
          case 'AND':
            output = inputValues.length > 0 && inputValues.every(v => v === true);
            break;
          case 'OR':
            output = inputValues.some(v => v === true);
            break;
          case 'NOT':
            output = inputValues.length > 0 ? !inputValues[0] : undefined;
            break;
          case 'NAND':
            output = inputValues.length > 0 ? !(inputValues.every(v => v === true)) : undefined;
            break;
          case 'NOR':
            output = inputValues.length > 0 ? !(inputValues.some(v => v === true)) : undefined;
            break;
          case 'XOR':
            output = inputValues.filter(v => v === true).length % 2 === 1;
            break;
          case 'XNOR':
            output = inputValues.filter(v => v === true).length % 2 === 0;
            break;
          case 'OUTPUT':
            output = inputValues.length > 0 ? inputValues[0] : undefined;
            break;
        }

        targetGate.value = output;
        
        // Add to queue for further propagation
        if (!visited.has(target.gateId)) {
          queue.push(target.gateId);
        }
      });
    }

    setCircuit({ ...circuitState, gates: Array.from(gateMap.values()) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2">
              Circuit Designer
            </h2>
            <p className="font-digital text-sm text-slate-400">
              Build your seven-segment decoder with logic gates
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          {/* Gate palette */}
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
            {(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'] as GateType[]).map(type => (
              <button
                key={type}
                onClick={() => addGate(type)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded font-tech text-sm transition-all duration-200 flex items-center gap-2"
                title={`Add ${type} gate`}
              >
                <Plus size={14} />
                {type}
              </button>
            ))}
          </div>

          {/* I/O */}
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
            <button
              onClick={() => addGate('INPUT')}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-tech text-sm transition-all duration-200"
              title="Add input switch"
            >
              + INPUT
            </button>
            <button
              onClick={() => addGate('OUTPUT')}
              className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded font-tech text-sm transition-all duration-200"
              title="Add segment output"
            >
              + OUTPUT
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700 ml-auto">
            <button
              onClick={undo}
              disabled={historyIndex === 0}
              className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded transition-all duration-200"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={18} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex === history.length - 1}
              className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded transition-all duration-200"
              title="Redo (Ctrl+Y)"
            >
              <Redo size={18} />
            </button>
            <button
              onClick={() => selectedGate && deleteGate(selectedGate)}
              disabled={!selectedGate}
              className="p-2 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-all duration-200"
              title="Delete selected (Delete)"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-slate-950 border-2 border-cyan-500/30 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={700}
          onClick={handleCanvasClick}
          className="cursor-crosshair"
        />
      </div>

      {/* Status bar */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 flex justify-between items-center font-digital text-xs text-slate-400">
        <span>{circuit.gates.length} gates, {circuit.wires.length} wires</span>
        {selectedGate && (
          <span className="text-cyan-400">
            Selected: {circuit.gates.find(g => g.id === selectedGate)?.type || 'None'}
          </span>
        )}
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
};
