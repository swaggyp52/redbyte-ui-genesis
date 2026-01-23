// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * CircuitCanvas - Real-time logic circuit visualization
 *
 * Renders schematic-style diagrams of the active experiment showing
 * inputs, outputs, gates, and animated data flow. Each experiment
 * has a unique circuit visualization.
 */

import React, { useMemo } from 'react';
import type { Experiment } from '../../labs/experiments';

interface CircuitCanvasProps {
  experiment: Experiment;
  inputs: { SW: number; BTN: number };
  outputs: { LED: number; SEG: number; AN: number; DP: number };
  tick: number;
}

// Wire component with animated data flow
const Wire: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  label?: string;
  labelPos?: 'start' | 'end' | 'middle';
}> = ({ x1, y1, x2, y2, active, label, labelPos = 'middle' }) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const labelX = labelPos === 'start' ? x1 : labelPos === 'end' ? x2 : mx;
  const labelY = labelPos === 'start' ? y1 - 8 : labelPos === 'end' ? y2 - 8 : my - 8;

  return (
    <g>
      {/* Wire glow (when active) */}
      {active && (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#00ff8844"
          strokeWidth="6"
          strokeLinecap="round"
        />
      )}
      {/* Wire base */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={active ? '#00ff88' : '#3a4a5a'}
        strokeWidth="2"
        strokeLinecap="round"
        className="transition-all duration-100"
      />
      {/* Data pulse animation */}
      {active && (
        <circle r="3" fill="#00ffaa">
          <animateMotion
            dur="0.5s"
            repeatCount="indefinite"
            path={`M${x1},${y1} L${x2},${y2}`}
          />
        </circle>
      )}
      {/* Label */}
      {label && (
        <text
          x={labelX}
          y={labelY}
          fill="#8899aa"
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
};

// Logic Gate components
const ANDGate: React.FC<{
  x: number;
  y: number;
  inputs: [boolean, boolean];
  label?: string;
}> = ({ x, y, inputs, label }) => {
  const output = inputs[0] && inputs[1];
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Gate body */}
      <path
        d="M 0 0 L 0 30 L 15 30 A 15 15 0 0 0 15 0 Z"
        fill={output ? '#1a3a2a' : '#1a2a3a'}
        stroke={output ? '#00ff88' : '#4a5a6a'}
        strokeWidth="2"
        className="transition-all duration-100"
      />
      {/* AND symbol */}
      <text x="8" y="20" fill="#8899aa" fontSize="8" fontFamily="monospace">&amp;</text>
      {/* Label */}
      {label && (
        <text x="15" y="-5" fill="#667788" fontSize="8" fontFamily="monospace" textAnchor="middle">{label}</text>
      )}
      {/* Input dots */}
      <circle cx="0" cy="8" r="3" fill={inputs[0] ? '#00ff88' : '#3a4a5a'} />
      <circle cx="0" cy="22" r="3" fill={inputs[1] ? '#00ff88' : '#3a4a5a'} />
      {/* Output dot */}
      <circle cx="30" cy="15" r="3" fill={output ? '#00ff88' : '#3a4a5a'} />
    </g>
  );
};

const ORGate: React.FC<{
  x: number;
  y: number;
  inputs: [boolean, boolean];
  label?: string;
}> = ({ x, y, inputs, label }) => {
  const output = inputs[0] || inputs[1];
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d="M 0 0 Q 10 15 0 30 Q 20 25 30 15 Q 20 5 0 0"
        fill={output ? '#1a3a2a' : '#1a2a3a'}
        stroke={output ? '#00ff88' : '#4a5a6a'}
        strokeWidth="2"
        className="transition-all duration-100"
      />
      <text x="10" y="20" fill="#8899aa" fontSize="10" fontFamily="monospace">&gt;1</text>
      {label && (
        <text x="15" y="-5" fill="#667788" fontSize="8" fontFamily="monospace" textAnchor="middle">{label}</text>
      )}
      <circle cx="0" cy="8" r="3" fill={inputs[0] ? '#00ff88' : '#3a4a5a'} />
      <circle cx="0" cy="22" r="3" fill={inputs[1] ? '#00ff88' : '#3a4a5a'} />
      <circle cx="30" cy="15" r="3" fill={output ? '#00ff88' : '#3a4a5a'} />
    </g>
  );
};

const XORGate: React.FC<{
  x: number;
  y: number;
  inputs: [boolean, boolean];
  label?: string;
}> = ({ x, y, inputs, label }) => {
  const output = inputs[0] !== inputs[1];
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d="M 5 0 Q 15 15 5 30"
        fill="none"
        stroke={output ? '#00ff88' : '#4a5a6a'}
        strokeWidth="2"
      />
      <path
        d="M 0 0 Q 10 15 0 30 Q 20 25 30 15 Q 20 5 0 0"
        fill={output ? '#1a3a2a' : '#1a2a3a'}
        stroke={output ? '#00ff88' : '#4a5a6a'}
        strokeWidth="2"
        className="transition-all duration-100"
      />
      <text x="10" y="20" fill="#8899aa" fontSize="10" fontFamily="monospace">=1</text>
      {label && (
        <text x="15" y="-5" fill="#667788" fontSize="8" fontFamily="monospace" textAnchor="middle">{label}</text>
      )}
      <circle cx="0" cy="8" r="3" fill={inputs[0] ? '#00ff88' : '#3a4a5a'} />
      <circle cx="0" cy="22" r="3" fill={inputs[1] ? '#00ff88' : '#3a4a5a'} />
      <circle cx="30" cy="15" r="3" fill={output ? '#00ff88' : '#3a4a5a'} />
    </g>
  );
};

const NOTGate: React.FC<{
  x: number;
  y: number;
  input: boolean;
  label?: string;
}> = ({ x, y, input, label }) => {
  const output = !input;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon
        points="0,0 25,12 0,24"
        fill={output ? '#1a3a2a' : '#1a2a3a'}
        stroke={output ? '#00ff88' : '#4a5a6a'}
        strokeWidth="2"
        className="transition-all duration-100"
      />
      <circle cx="28" cy="12" r="3" fill="none" stroke={output ? '#00ff88' : '#4a5a6a'} strokeWidth="2" />
      {label && (
        <text x="15" y="-5" fill="#667788" fontSize="8" fontFamily="monospace" textAnchor="middle">{label}</text>
      )}
      <circle cx="0" cy="12" r="3" fill={input ? '#00ff88' : '#3a4a5a'} />
      <circle cx="33" cy="12" r="3" fill={output ? '#00ff88' : '#3a4a5a'} />
    </g>
  );
};

// Input/Output terminals
const Terminal: React.FC<{
  x: number;
  y: number;
  label: string;
  value: boolean | number;
  type: 'input' | 'output';
}> = ({ x, y, label, value, type }) => {
  const active = typeof value === 'boolean' ? value : value > 0;
  const displayValue = typeof value === 'boolean' ? (value ? '1' : '0') : value.toString(2).padStart(4, '0');

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="-25"
        y="-12"
        width="50"
        height="24"
        rx="4"
        fill={active ? '#1a2a1a' : '#1a1a2a'}
        stroke={active ? '#00ff88' : '#3a4a5a'}
        strokeWidth="2"
        className="transition-all duration-100"
      />
      <text x="0" y="-16" fill="#667788" fontSize="9" fontFamily="monospace" textAnchor="middle">{label}</text>
      <text
        x="0"
        y="5"
        fill={active ? '#00ff88' : '#8899aa'}
        fontSize="11"
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="middle"
      >
        {displayValue}
      </text>
      {/* Connection point */}
      <circle
        cx={type === 'input' ? 30 : -30}
        cy="0"
        r="4"
        fill={active ? '#00ff88' : '#3a4a5a'}
        className="transition-all duration-100"
      />
    </g>
  );
};

// Counter/Register visualization
const Register: React.FC<{
  x: number;
  y: number;
  label: string;
  value: number;
  bits: number;
}> = ({ x, y, label, value, bits }) => {
  const binaryStr = value.toString(2).padStart(bits, '0');

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="-40"
        y="-20"
        width="80"
        height="40"
        rx="4"
        fill="#1a1a2a"
        stroke="#4a5a6a"
        strokeWidth="2"
      />
      <text x="0" y="-24" fill="#667788" fontSize="9" fontFamily="monospace" textAnchor="middle">{label}</text>
      {/* Bit display */}
      <g transform="translate(-32, -8)">
        {binaryStr.split('').map((bit, i) => (
          <g key={i} transform={`translate(${i * 8}, 0)`}>
            <rect
              width="6"
              height="16"
              rx="1"
              fill={bit === '1' ? '#00ff88' : '#2a2a3a'}
              className="transition-all duration-100"
            />
          </g>
        ))}
      </g>
      {/* Decimal value */}
      <text x="0" y="30" fill="#8899aa" fontSize="10" fontFamily="monospace" textAnchor="middle">
        {value}
      </text>
    </g>
  );
};

// FSM State visualization
const FSMState: React.FC<{
  x: number;
  y: number;
  label: string;
  active: boolean;
  color?: string;
}> = ({ x, y, label, active, color = '#00ff88' }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r="20"
        fill={active ? '#1a2a1a' : '#1a1a2a'}
        stroke={active ? color : '#3a4a5a'}
        strokeWidth={active ? 3 : 2}
        className="transition-all duration-200"
      />
      {active && (
        <circle r="24" fill="none" stroke={color} strokeWidth="1" opacity="0.5">
          <animate attributeName="r" values="20;28;20" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
      <text
        y="4"
        fill={active ? color : '#8899aa'}
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
};

// Experiment-specific circuit renderers
const LoopbackCircuit: React.FC<{ inputs: CircuitCanvasProps['inputs']; outputs: CircuitCanvasProps['outputs'] }> = ({ inputs, outputs }) => {
  const sw0 = (inputs.SW & 1) > 0;
  const sw1 = (inputs.SW & 2) > 0;

  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200">
      <text x="200" y="20" fill="#4a5a6a" fontSize="12" fontFamily="monospace" textAnchor="middle">
        LOOPBACK: SW → LED
      </text>

      {/* Inputs */}
      <Terminal x={60} y={80} label="SW[0]" value={sw0} type="input" />
      <Terminal x={60} y={130} label="SW[1]" value={sw1} type="input" />

      {/* Direct wires */}
      <Wire x1={90} y1={80} x2={280} y2={80} active={sw0} />
      <Wire x1={90} y1={130} x2={280} y2={130} active={sw1} />

      {/* Outputs */}
      <Terminal x={340} y={80} label="LED[0]" value={(outputs.LED & 1) > 0} type="output" />
      <Terminal x={340} y={130} label="LED[1]" value={(outputs.LED & 2) > 0} type="output" />

      {/* Info */}
      <text x="200" y="180" fill="#3a4a5a" fontSize="9" fontFamily="monospace" textAnchor="middle">
        Direct connection - switches control LEDs
      </text>
    </svg>
  );
};

const InvertCircuit: React.FC<{ inputs: CircuitCanvasProps['inputs']; outputs: CircuitCanvasProps['outputs'] }> = ({ inputs, outputs }) => {
  const sw0 = (inputs.SW & 1) > 0;
  const sw1 = (inputs.SW & 2) > 0;

  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200">
      <text x="200" y="20" fill="#4a5a6a" fontSize="12" fontFamily="monospace" textAnchor="middle">
        INVERTER: LED = ~SW
      </text>

      <Terminal x={60} y={80} label="SW[0]" value={sw0} type="input" />
      <Terminal x={60} y={130} label="SW[1]" value={sw1} type="input" />

      <Wire x1={90} y1={80} x2={160} y2={80} active={sw0} />
      <Wire x1={90} y1={130} x2={160} y2={130} active={sw1} />

      <NOTGate x={170} y={68} input={sw0} label="NOT" />
      <NOTGate x={170} y={118} input={sw1} label="NOT" />

      <Wire x1={210} y1={80} x2={280} y2={80} active={!sw0} />
      <Wire x1={210} y1={130} x2={280} y2={130} active={!sw1} />

      <Terminal x={340} y={80} label="LED[0]" value={!sw0} type="output" />
      <Terminal x={340} y={130} label="LED[1]" value={!sw1} type="output" />
    </svg>
  );
};

const LogicGatesCircuit: React.FC<{ inputs: CircuitCanvasProps['inputs']; outputs: CircuitCanvasProps['outputs'] }> = ({ inputs, outputs }) => {
  const a = (inputs.SW & 1) > 0;
  const b = (inputs.SW & 2) > 0;
  const andOut = a && b;
  const orOut = a || b;
  const xorOut = a !== b;

  return (
    <svg width="100%" height="100%" viewBox="0 0 500 250">
      <text x="250" y="20" fill="#4a5a6a" fontSize="12" fontFamily="monospace" textAnchor="middle">
        LOGIC GATES DEMO
      </text>

      {/* Inputs */}
      <Terminal x={60} y={70} label="A (SW0)" value={a} type="input" />
      <Terminal x={60} y={180} label="B (SW1)" value={b} type="input" />

      {/* Input bus lines */}
      <Wire x1={90} y1={70} x2={140} y2={70} active={a} />
      <Wire x1={140} y1={70} x2={140} y2={180} active={a || b} />
      <Wire x1={90} y1={180} x2={140} y2={180} active={b} />

      {/* Branch to AND */}
      <Wire x1={140} y1={70} x2={200} y2={58} active={a} />
      <Wire x1={140} y1={100} x2={200} y2={72} active={b} />

      {/* Branch to OR */}
      <Wire x1={140} y1={100} x2={200} y2={108} active={a} />
      <Wire x1={140} y1={140} x2={200} y2={122} active={b} />

      {/* Branch to XOR */}
      <Wire x1={140} y1={140} x2={200} y2={158} active={a} />
      <Wire x1={140} y1={180} x2={200} y2={172} active={b} />

      {/* Gates */}
      <ANDGate x={210} y={50} inputs={[a, b]} label="AND" />
      <ORGate x={210} y={100} inputs={[a, b]} label="OR" />
      <XORGate x={210} y={150} inputs={[a, b]} label="XOR" />

      {/* Output wires */}
      <Wire x1={240} y1={65} x2={340} y2={65} active={andOut} />
      <Wire x1={240} y1={115} x2={340} y2={115} active={orOut} />
      <Wire x1={240} y1={165} x2={340} y2={165} active={xorOut} />

      {/* Outputs */}
      <Terminal x={400} y={65} label="LED[0]" value={andOut} type="output" />
      <Terminal x={400} y={115} label="LED[1]" value={orOut} type="output" />
      <Terminal x={400} y={165} label="LED[2]" value={xorOut} type="output" />
    </svg>
  );
};

const CounterCircuit: React.FC<{
  inputs: CircuitCanvasProps['inputs'];
  outputs: CircuitCanvasProps['outputs'];
  tick: number;
}> = ({ inputs, outputs, tick }) => {
  const enable = (inputs.SW & 1) > 0;
  const reset = (inputs.BTN & 1) > 0;
  const count = outputs.LED & 0xFF;

  return (
    <svg width="100%" height="100%" viewBox="0 0 500 220">
      <text x="250" y="20" fill="#4a5a6a" fontSize="12" fontFamily="monospace" textAnchor="middle">
        8-BIT BINARY COUNTER
      </text>

      {/* Control inputs */}
      <Terminal x={60} y={80} label="EN (SW0)" value={enable} type="input" />
      <Terminal x={60} y={140} label="RST (BTN)" value={reset} type="input" />

      {/* Clock */}
      <g transform="translate(60, 180)">
        <rect x="-25" y="-12" width="50" height="24" rx="4" fill="#2a1a2a" stroke="#8a4a8a" strokeWidth="2" />
        <text x="0" y="-16" fill="#8a4a8a" fontSize="9" fontFamily="monospace" textAnchor="middle">CLK</text>
        <text x="0" y="5" fill="#aa6aaa" fontSize="10" fontFamily="monospace" textAnchor="middle">
          T:{tick}
        </text>
      </g>

      {/* Wires to counter */}
      <Wire x1={90} y1={80} x2={180} y2={90} active={enable} label="enable" />
      <Wire x1={90} y1={140} x2={180} y2={110} active={reset} label="reset" />
      <Wire x1={90} y1={180} x2={180} y2={130} active={tick % 2 === 0} label="clock" />

      {/* Counter register */}
      <Register x={250} y={110} label="COUNT[7:0]" value={count} bits={8} />

      {/* Output */}
      <Wire x1={290} y1={110} x2={360} y2={110} active={count > 0} />
      <Terminal x={420} y={110} label="LED[7:0]" value={count} type="output" />

      {/* Status text */}
      <text x="250" y="200" fill="#3a4a5a" fontSize="9" fontFamily="monospace" textAnchor="middle">
        {reset ? 'RESET ACTIVE' : enable ? `COUNTING: ${count}` : 'COUNTER PAUSED'}
      </text>
    </svg>
  );
};

const TrafficLightCircuit: React.FC<{
  inputs: CircuitCanvasProps['inputs'];
  outputs: CircuitCanvasProps['outputs'];
}> = ({ inputs, outputs }) => {
  const led = outputs.LED;
  const redActive = (led & 0b100) > 0;
  const yellowActive = (led & 0b010) > 0;
  const greenActive = (led & 0b001) > 0;

  const currentState = redActive ? 0 : greenActive ? 1 : yellowActive ? 2 : 0;
  const stateNames = ['RED', 'GREEN', 'YELLOW'];

  return (
    <svg width="100%" height="100%" viewBox="0 0 500 280">
      <text x="250" y="20" fill="#4a5a6a" fontSize="12" fontFamily="monospace" textAnchor="middle">
        TRAFFIC LIGHT FSM
      </text>

      {/* Button input */}
      <Terminal x={80} y={140} label="BTN (Next)" value={(inputs.BTN & 1) > 0} type="input" />

      {/* FSM States */}
      <FSMState x={200} y={80} label="RED" active={currentState === 0} color="#ff4444" />
      <FSMState x={300} y={140} label="GRN" active={currentState === 1} color="#44ff44" />
      <FSMState x={200} y={200} label="YLW" active={currentState === 2} color="#ffff44" />

      {/* State transitions (arrows) */}
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="#4a5a6a" />
        </marker>
      </defs>
      <path d="M 220 90 Q 260 100 280 130" fill="none" stroke="#4a5a6a" strokeWidth="2" markerEnd="url(#arrowhead)" />
      <path d="M 280 150 Q 260 180 220 190" fill="none" stroke="#4a5a6a" strokeWidth="2" markerEnd="url(#arrowhead)" />
      <path d="M 180 190 Q 160 140 180 90" fill="none" stroke="#4a5a6a" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Traffic light visualization */}
      <g transform="translate(400, 100)">
        <rect x="-20" y="-10" width="40" height="100" rx="4" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="2" />
        {/* Red */}
        <circle cx="0" cy="10" r="12" fill={redActive ? '#ff4444' : '#331111'} />
        {redActive && <circle cx="0" cy="10" r="16" fill="none" stroke="#ff4444" opacity="0.5" />}
        {/* Yellow */}
        <circle cx="0" cy="40" r="12" fill={yellowActive ? '#ffff44' : '#333311'} />
        {yellowActive && <circle cx="0" cy="40" r="16" fill="none" stroke="#ffff44" opacity="0.5" />}
        {/* Green */}
        <circle cx="0" cy="70" r="12" fill={greenActive ? '#44ff44' : '#113311'} />
        {greenActive && <circle cx="0" cy="70" r="16" fill="none" stroke="#44ff44" opacity="0.5" />}
      </g>

      {/* Current state label */}
      <text x="250" y="260" fill="#667788" fontSize="11" fontFamily="monospace" textAnchor="middle">
        Current State: {stateNames[currentState]}
      </text>
    </svg>
  );
};

// Default circuit (for experiments without specific visualization)
const DefaultCircuit: React.FC<{
  experiment: Experiment;
  inputs: CircuitCanvasProps['inputs'];
  outputs: CircuitCanvasProps['outputs'];
}> = ({ experiment, inputs, outputs }) => {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200">
      <text x="200" y="30" fill="#4a5a6a" fontSize="14" fontFamily="monospace" textAnchor="middle">
        {experiment.name.toUpperCase()}
      </text>

      {/* Generic I/O display */}
      <g transform="translate(60, 80)">
        <text y="-10" fill="#667788" fontSize="10" fontFamily="monospace">INPUTS</text>
        <Terminal x={40} y={20} label="SW" value={inputs.SW} type="input" />
        <Terminal x={40} y={60} label="BTN" value={inputs.BTN} type="input" />
      </g>

      {/* Processing box */}
      <g transform="translate(200, 100)">
        <rect x="-40" y="-30" width="80" height="60" rx="4" fill="#1a2a3a" stroke="#4a5a6a" strokeWidth="2" strokeDasharray="4" />
        <text y="5" fill="#667788" fontSize="9" fontFamily="monospace" textAnchor="middle">LOGIC</text>
      </g>

      <g transform="translate(340, 80)">
        <text y="-10" fill="#667788" fontSize="10" fontFamily="monospace">OUTPUTS</text>
        <Terminal x={0} y={20} label="LED" value={outputs.LED} type="output" />
      </g>

      {/* Wires */}
      <Wire x1={100} y1={100} x2={160} y2={100} active={inputs.SW > 0 || inputs.BTN > 0} />
      <Wire x1={240} y1={100} x2={300} y2={100} active={outputs.LED > 0} />

      <text x="200" y="180" fill="#3a4a5a" fontSize="9" fontFamily="monospace" textAnchor="middle">
        {experiment.description}
      </text>
    </svg>
  );
};

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  experiment,
  inputs,
  outputs,
  tick,
}) => {
  const circuitContent = useMemo(() => {
    switch (experiment.id) {
      case 'loopback':
        return <LoopbackCircuit inputs={inputs} outputs={outputs} />;
      case 'invert':
        return <InvertCircuit inputs={inputs} outputs={outputs} />;
      case 'logic':
        return <LogicGatesCircuit inputs={inputs} outputs={outputs} />;
      case 'counter':
        return <CounterCircuit inputs={inputs} outputs={outputs} tick={tick} />;
      case 'traffic':
        return <TrafficLightCircuit inputs={inputs} outputs={outputs} />;
      default:
        return <DefaultCircuit experiment={experiment} inputs={inputs} outputs={outputs} />;
    }
  }, [experiment, inputs, outputs, tick]);

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 50% 50%, #0a1520 0%, #050a10 100%)
        `,
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Circuit visualization */}
      <div className="absolute inset-4">
        {circuitContent}
      </div>

      {/* Oscilloscope-style border */}
      <div className="absolute inset-0 pointer-events-none border border-[#1a3a2a] rounded-lg" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00ff8844] to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00ff8844] to-transparent" />
    </div>
  );
};

export default CircuitCanvas;
