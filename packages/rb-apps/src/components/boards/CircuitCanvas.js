import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useMemo } from 'react';
import { useRenderStormDetector } from '../../hooks/useRenderStormDetector';
// Wire component with animated data flow
const Wire = ({ x1, y1, x2, y2, active, label, labelPos = 'middle' }) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const labelX = labelPos === 'start' ? x1 : labelPos === 'end' ? x2 : mx;
    const labelY = labelPos === 'start' ? y1 - 8 : labelPos === 'end' ? y2 - 8 : my - 8;
    return (_jsxs("g", { children: [active && (_jsx("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: "#00ff8844", strokeWidth: "6", strokeLinecap: "round" })), _jsx("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: active ? '#00ff88' : '#3a4a5a', strokeWidth: "2", strokeLinecap: "round", className: "transition-all duration-100" }), active && (_jsx("circle", { r: "3", fill: "#00ffaa", children: _jsx("animateMotion", { dur: "0.5s", repeatCount: "indefinite", path: `M${x1},${y1} L${x2},${y2}` }) })), label && (_jsx("text", { x: labelX, y: labelY, fill: "#8899aa", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: label }))] }));
};
// Logic Gate components
const ANDGate = ({ x, y, inputs, label }) => {
    const output = inputs[0] && inputs[1];
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("path", { d: "M 0 0 L 0 30 L 15 30 A 15 15 0 0 0 15 0 Z", fill: output ? '#1a3a2a' : '#1a2a3a', stroke: output ? '#00ff88' : '#4a5a6a', strokeWidth: "2", className: "transition-all duration-100" }), _jsx("text", { x: "8", y: "20", fill: "#8899aa", fontSize: "8", fontFamily: "monospace", children: "&" }), label && (_jsx("text", { x: "15", y: "-5", fill: "#667788", fontSize: "8", fontFamily: "monospace", textAnchor: "middle", children: label })), _jsx("circle", { cx: "0", cy: "8", r: "3", fill: inputs[0] ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "0", cy: "22", r: "3", fill: inputs[1] ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "30", cy: "15", r: "3", fill: output ? '#00ff88' : '#3a4a5a' })] }));
};
const ORGate = ({ x, y, inputs, label }) => {
    const output = inputs[0] || inputs[1];
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("path", { d: "M 0 0 Q 10 15 0 30 Q 20 25 30 15 Q 20 5 0 0", fill: output ? '#1a3a2a' : '#1a2a3a', stroke: output ? '#00ff88' : '#4a5a6a', strokeWidth: "2", className: "transition-all duration-100" }), _jsx("text", { x: "10", y: "20", fill: "#8899aa", fontSize: "10", fontFamily: "monospace", children: ">1" }), label && (_jsx("text", { x: "15", y: "-5", fill: "#667788", fontSize: "8", fontFamily: "monospace", textAnchor: "middle", children: label })), _jsx("circle", { cx: "0", cy: "8", r: "3", fill: inputs[0] ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "0", cy: "22", r: "3", fill: inputs[1] ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "30", cy: "15", r: "3", fill: output ? '#00ff88' : '#3a4a5a' })] }));
};
const XORGate = ({ x, y, inputs, label }) => {
    const output = inputs[0] !== inputs[1];
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("path", { d: "M 5 0 Q 15 15 5 30", fill: "none", stroke: output ? '#00ff88' : '#4a5a6a', strokeWidth: "2" }), _jsx("path", { d: "M 0 0 Q 10 15 0 30 Q 20 25 30 15 Q 20 5 0 0", fill: output ? '#1a3a2a' : '#1a2a3a', stroke: output ? '#00ff88' : '#4a5a6a', strokeWidth: "2", className: "transition-all duration-100" }), _jsx("text", { x: "10", y: "20", fill: "#8899aa", fontSize: "10", fontFamily: "monospace", children: "=1" }), label && (_jsx("text", { x: "15", y: "-5", fill: "#667788", fontSize: "8", fontFamily: "monospace", textAnchor: "middle", children: label })), _jsx("circle", { cx: "0", cy: "8", r: "3", fill: inputs[0] ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "0", cy: "22", r: "3", fill: inputs[1] ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "30", cy: "15", r: "3", fill: output ? '#00ff88' : '#3a4a5a' })] }));
};
const NOTGate = ({ x, y, input, label }) => {
    const output = !input;
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("polygon", { points: "0,0 25,12 0,24", fill: output ? '#1a3a2a' : '#1a2a3a', stroke: output ? '#00ff88' : '#4a5a6a', strokeWidth: "2", className: "transition-all duration-100" }), _jsx("circle", { cx: "28", cy: "12", r: "3", fill: "none", stroke: output ? '#00ff88' : '#4a5a6a', strokeWidth: "2" }), label && (_jsx("text", { x: "15", y: "-5", fill: "#667788", fontSize: "8", fontFamily: "monospace", textAnchor: "middle", children: label })), _jsx("circle", { cx: "0", cy: "12", r: "3", fill: input ? '#00ff88' : '#3a4a5a' }), _jsx("circle", { cx: "33", cy: "12", r: "3", fill: output ? '#00ff88' : '#3a4a5a' })] }));
};
// Input/Output terminals
const Terminal = ({ x, y, label, value, type }) => {
    const active = typeof value === 'boolean' ? value : value > 0;
    const displayValue = typeof value === 'boolean' ? (value ? '1' : '0') : value.toString(2).padStart(4, '0');
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("rect", { x: "-25", y: "-12", width: "50", height: "24", rx: "4", fill: active ? '#1a2a1a' : '#1a1a2a', stroke: active ? '#00ff88' : '#3a4a5a', strokeWidth: "2", className: "transition-all duration-100" }), _jsx("text", { x: "0", y: "-16", fill: "#667788", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: label }), _jsx("text", { x: "0", y: "5", fill: active ? '#00ff88' : '#8899aa', fontSize: "11", fontFamily: "monospace", fontWeight: "bold", textAnchor: "middle", children: displayValue }), _jsx("circle", { cx: type === 'input' ? 30 : -30, cy: "0", r: "4", fill: active ? '#00ff88' : '#3a4a5a', className: "transition-all duration-100" })] }));
};
// Counter/Register visualization
const Register = ({ x, y, label, value, bits }) => {
    const binaryStr = value.toString(2).padStart(bits, '0');
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("rect", { x: "-40", y: "-20", width: "80", height: "40", rx: "4", fill: "#1a1a2a", stroke: "#4a5a6a", strokeWidth: "2" }), _jsx("text", { x: "0", y: "-24", fill: "#667788", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: label }), _jsx("g", { transform: "translate(-32, -8)", children: binaryStr.split('').map((bit, i) => (_jsx("g", { transform: `translate(${i * 8}, 0)`, children: _jsx("rect", { width: "6", height: "16", rx: "1", fill: bit === '1' ? '#00ff88' : '#2a2a3a', className: "transition-all duration-100" }) }, i))) }), _jsx("text", { x: "0", y: "30", fill: "#8899aa", fontSize: "10", fontFamily: "monospace", textAnchor: "middle", children: value })] }));
};
// FSM State visualization
const FSMState = ({ x, y, label, active, color = '#00ff88' }) => {
    return (_jsxs("g", { transform: `translate(${x}, ${y})`, children: [_jsx("circle", { r: "20", fill: active ? '#1a2a1a' : '#1a1a2a', stroke: active ? color : '#3a4a5a', strokeWidth: active ? 3 : 2, className: "transition-all duration-200" }), active && (_jsxs("circle", { r: "24", fill: "none", stroke: color, strokeWidth: "1", opacity: "0.5", children: [_jsx("animate", { attributeName: "r", values: "20;28;20", dur: "1s", repeatCount: "indefinite" }), _jsx("animate", { attributeName: "opacity", values: "0.5;0;0.5", dur: "1s", repeatCount: "indefinite" })] })), _jsx("text", { y: "4", fill: active ? color : '#8899aa', fontSize: "10", fontFamily: "monospace", fontWeight: "bold", textAnchor: "middle", children: label })] }));
};
// Experiment-specific circuit renderers
const LoopbackCircuit = ({ inputs, outputs }) => {
    const sw0 = (inputs.SW & 1) > 0;
    const sw1 = (inputs.SW & 2) > 0;
    return (_jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 400 200", children: [_jsx("text", { x: "200", y: "20", fill: "#4a5a6a", fontSize: "12", fontFamily: "monospace", textAnchor: "middle", children: "LOOPBACK: SW \u2192 LED" }), _jsx(Terminal, { x: 60, y: 80, label: "SW[0]", value: sw0, type: "input" }), _jsx(Terminal, { x: 60, y: 130, label: "SW[1]", value: sw1, type: "input" }), _jsx(Wire, { x1: 90, y1: 80, x2: 280, y2: 80, active: sw0 }), _jsx(Wire, { x1: 90, y1: 130, x2: 280, y2: 130, active: sw1 }), _jsx(Terminal, { x: 340, y: 80, label: "LED[0]", value: (outputs.LED & 1) > 0, type: "output" }), _jsx(Terminal, { x: 340, y: 130, label: "LED[1]", value: (outputs.LED & 2) > 0, type: "output" }), _jsx("text", { x: "200", y: "180", fill: "#3a4a5a", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: "Direct connection - switches control LEDs" })] }));
};
const InvertCircuit = ({ inputs, outputs }) => {
    const sw0 = (inputs.SW & 1) > 0;
    const sw1 = (inputs.SW & 2) > 0;
    return (_jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 400 200", children: [_jsx("text", { x: "200", y: "20", fill: "#4a5a6a", fontSize: "12", fontFamily: "monospace", textAnchor: "middle", children: "INVERTER: LED = ~SW" }), _jsx(Terminal, { x: 60, y: 80, label: "SW[0]", value: sw0, type: "input" }), _jsx(Terminal, { x: 60, y: 130, label: "SW[1]", value: sw1, type: "input" }), _jsx(Wire, { x1: 90, y1: 80, x2: 160, y2: 80, active: sw0 }), _jsx(Wire, { x1: 90, y1: 130, x2: 160, y2: 130, active: sw1 }), _jsx(NOTGate, { x: 170, y: 68, input: sw0, label: "NOT" }), _jsx(NOTGate, { x: 170, y: 118, input: sw1, label: "NOT" }), _jsx(Wire, { x1: 210, y1: 80, x2: 280, y2: 80, active: !sw0 }), _jsx(Wire, { x1: 210, y1: 130, x2: 280, y2: 130, active: !sw1 }), _jsx(Terminal, { x: 340, y: 80, label: "LED[0]", value: !sw0, type: "output" }), _jsx(Terminal, { x: 340, y: 130, label: "LED[1]", value: !sw1, type: "output" })] }));
};
const LogicGatesCircuit = ({ inputs, outputs }) => {
    const a = (inputs.SW & 1) > 0;
    const b = (inputs.SW & 2) > 0;
    const andOut = a && b;
    const orOut = a || b;
    const xorOut = a !== b;
    return (_jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 500 250", children: [_jsx("text", { x: "250", y: "20", fill: "#4a5a6a", fontSize: "12", fontFamily: "monospace", textAnchor: "middle", children: "LOGIC GATES DEMO" }), _jsx(Terminal, { x: 60, y: 70, label: "A (SW0)", value: a, type: "input" }), _jsx(Terminal, { x: 60, y: 180, label: "B (SW1)", value: b, type: "input" }), _jsx(Wire, { x1: 90, y1: 70, x2: 140, y2: 70, active: a }), _jsx(Wire, { x1: 140, y1: 70, x2: 140, y2: 180, active: a || b }), _jsx(Wire, { x1: 90, y1: 180, x2: 140, y2: 180, active: b }), _jsx(Wire, { x1: 140, y1: 70, x2: 200, y2: 58, active: a }), _jsx(Wire, { x1: 140, y1: 100, x2: 200, y2: 72, active: b }), _jsx(Wire, { x1: 140, y1: 100, x2: 200, y2: 108, active: a }), _jsx(Wire, { x1: 140, y1: 140, x2: 200, y2: 122, active: b }), _jsx(Wire, { x1: 140, y1: 140, x2: 200, y2: 158, active: a }), _jsx(Wire, { x1: 140, y1: 180, x2: 200, y2: 172, active: b }), _jsx(ANDGate, { x: 210, y: 50, inputs: [a, b], label: "AND" }), _jsx(ORGate, { x: 210, y: 100, inputs: [a, b], label: "OR" }), _jsx(XORGate, { x: 210, y: 150, inputs: [a, b], label: "XOR" }), _jsx(Wire, { x1: 240, y1: 65, x2: 340, y2: 65, active: andOut }), _jsx(Wire, { x1: 240, y1: 115, x2: 340, y2: 115, active: orOut }), _jsx(Wire, { x1: 240, y1: 165, x2: 340, y2: 165, active: xorOut }), _jsx(Terminal, { x: 400, y: 65, label: "LED[0]", value: andOut, type: "output" }), _jsx(Terminal, { x: 400, y: 115, label: "LED[1]", value: orOut, type: "output" }), _jsx(Terminal, { x: 400, y: 165, label: "LED[2]", value: xorOut, type: "output" })] }));
};
const CounterCircuit = ({ inputs, outputs, tick }) => {
    const enable = (inputs.SW & 1) > 0;
    const reset = (inputs.BTN & 1) > 0;
    const count = outputs.LED & 0xFF;
    return (_jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 500 220", children: [_jsx("text", { x: "250", y: "20", fill: "#4a5a6a", fontSize: "12", fontFamily: "monospace", textAnchor: "middle", children: "8-BIT BINARY COUNTER" }), _jsx(Terminal, { x: 60, y: 80, label: "EN (SW0)", value: enable, type: "input" }), _jsx(Terminal, { x: 60, y: 140, label: "RST (BTN)", value: reset, type: "input" }), _jsxs("g", { transform: "translate(60, 180)", children: [_jsx("rect", { x: "-25", y: "-12", width: "50", height: "24", rx: "4", fill: "#2a1a2a", stroke: "#8a4a8a", strokeWidth: "2" }), _jsx("text", { x: "0", y: "-16", fill: "#8a4a8a", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: "CLK" }), _jsxs("text", { x: "0", y: "5", fill: "#aa6aaa", fontSize: "10", fontFamily: "monospace", textAnchor: "middle", children: ["T:", tick] })] }), _jsx(Wire, { x1: 90, y1: 80, x2: 180, y2: 90, active: enable, label: "enable" }), _jsx(Wire, { x1: 90, y1: 140, x2: 180, y2: 110, active: reset, label: "reset" }), _jsx(Wire, { x1: 90, y1: 180, x2: 180, y2: 130, active: tick % 2 === 0, label: "clock" }), _jsx(Register, { x: 250, y: 110, label: "COUNT[7:0]", value: count, bits: 8 }), _jsx(Wire, { x1: 290, y1: 110, x2: 360, y2: 110, active: count > 0 }), _jsx(Terminal, { x: 420, y: 110, label: "LED[7:0]", value: count, type: "output" }), _jsx("text", { x: "250", y: "200", fill: "#3a4a5a", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: reset ? 'RESET ACTIVE' : enable ? `COUNTING: ${count}` : 'COUNTER PAUSED' })] }));
};
const TrafficLightCircuit = ({ inputs, outputs }) => {
    const led = outputs.LED;
    const redActive = (led & 0b100) > 0;
    const yellowActive = (led & 0b010) > 0;
    const greenActive = (led & 0b001) > 0;
    const currentState = redActive ? 0 : greenActive ? 1 : yellowActive ? 2 : 0;
    const stateNames = ['RED', 'GREEN', 'YELLOW'];
    return (_jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 500 280", children: [_jsx("text", { x: "250", y: "20", fill: "#4a5a6a", fontSize: "12", fontFamily: "monospace", textAnchor: "middle", children: "TRAFFIC LIGHT FSM" }), _jsx(Terminal, { x: 80, y: 140, label: "BTN (Next)", value: (inputs.BTN & 1) > 0, type: "input" }), _jsx(FSMState, { x: 200, y: 80, label: "RED", active: currentState === 0, color: "#ff4444" }), _jsx(FSMState, { x: 300, y: 140, label: "GRN", active: currentState === 1, color: "#44ff44" }), _jsx(FSMState, { x: 200, y: 200, label: "YLW", active: currentState === 2, color: "#ffff44" }), _jsx("defs", { children: _jsx("marker", { id: "arrowhead", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto", children: _jsx("polygon", { points: "0 0, 6 3, 0 6", fill: "#4a5a6a" }) }) }), _jsx("path", { d: "M 220 90 Q 260 100 280 130", fill: "none", stroke: "#4a5a6a", strokeWidth: "2", markerEnd: "url(#arrowhead)" }), _jsx("path", { d: "M 280 150 Q 260 180 220 190", fill: "none", stroke: "#4a5a6a", strokeWidth: "2", markerEnd: "url(#arrowhead)" }), _jsx("path", { d: "M 180 190 Q 160 140 180 90", fill: "none", stroke: "#4a5a6a", strokeWidth: "2", markerEnd: "url(#arrowhead)" }), _jsxs("g", { transform: "translate(400, 100)", children: [_jsx("rect", { x: "-20", y: "-10", width: "40", height: "100", rx: "4", fill: "#1a1a1a", stroke: "#3a3a3a", strokeWidth: "2" }), _jsx("circle", { cx: "0", cy: "10", r: "12", fill: redActive ? '#ff4444' : '#331111' }), redActive && _jsx("circle", { cx: "0", cy: "10", r: "16", fill: "none", stroke: "#ff4444", opacity: "0.5" }), _jsx("circle", { cx: "0", cy: "40", r: "12", fill: yellowActive ? '#ffff44' : '#333311' }), yellowActive && _jsx("circle", { cx: "0", cy: "40", r: "16", fill: "none", stroke: "#ffff44", opacity: "0.5" }), _jsx("circle", { cx: "0", cy: "70", r: "12", fill: greenActive ? '#44ff44' : '#113311' }), greenActive && _jsx("circle", { cx: "0", cy: "70", r: "16", fill: "none", stroke: "#44ff44", opacity: "0.5" })] }), _jsxs("text", { x: "250", y: "260", fill: "#667788", fontSize: "11", fontFamily: "monospace", textAnchor: "middle", children: ["Current State: ", stateNames[currentState]] })] }));
};
// Default circuit (for experiments without specific visualization)
const DefaultCircuit = ({ experiment, inputs, outputs }) => {
    return (_jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 400 200", children: [_jsx("text", { x: "200", y: "30", fill: "#4a5a6a", fontSize: "14", fontFamily: "monospace", textAnchor: "middle", children: experiment.name.toUpperCase() }), _jsxs("g", { transform: "translate(60, 80)", children: [_jsx("text", { y: "-10", fill: "#667788", fontSize: "10", fontFamily: "monospace", children: "INPUTS" }), _jsx(Terminal, { x: 40, y: 20, label: "SW", value: inputs.SW, type: "input" }), _jsx(Terminal, { x: 40, y: 60, label: "BTN", value: inputs.BTN, type: "input" })] }), _jsxs("g", { transform: "translate(200, 100)", children: [_jsx("rect", { x: "-40", y: "-30", width: "80", height: "60", rx: "4", fill: "#1a2a3a", stroke: "#4a5a6a", strokeWidth: "2", strokeDasharray: "4" }), _jsx("text", { y: "5", fill: "#667788", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: "LOGIC" })] }), _jsxs("g", { transform: "translate(340, 80)", children: [_jsx("text", { y: "-10", fill: "#667788", fontSize: "10", fontFamily: "monospace", children: "OUTPUTS" }), _jsx(Terminal, { x: 0, y: 20, label: "LED", value: outputs.LED, type: "output" })] }), _jsx(Wire, { x1: 100, y1: 100, x2: 160, y2: 100, active: inputs.SW > 0 || inputs.BTN > 0 }), _jsx(Wire, { x1: 240, y1: 100, x2: 300, y2: 100, active: outputs.LED > 0 }), _jsx("text", { x: "200", y: "180", fill: "#3a4a5a", fontSize: "9", fontFamily: "monospace", textAnchor: "middle", children: experiment.description })] }));
};
export const CircuitCanvas = ({ experiment, inputs, outputs, tick, }) => {
    useRenderStormDetector('CircuitCanvas');
    const circuitContent = useMemo(() => {
        switch (experiment.id) {
            case 'loopback':
                return _jsx(LoopbackCircuit, { inputs: inputs, outputs: outputs });
            case 'invert':
                return _jsx(InvertCircuit, { inputs: inputs, outputs: outputs });
            case 'logic':
                return _jsx(LogicGatesCircuit, { inputs: inputs, outputs: outputs });
            case 'counter':
                return _jsx(CounterCircuit, { inputs: inputs, outputs: outputs, tick: tick });
            case 'traffic':
                return _jsx(TrafficLightCircuit, { inputs: inputs, outputs: outputs });
            default:
                return _jsx(DefaultCircuit, { experiment: experiment, inputs: inputs, outputs: outputs });
        }
    }, [experiment, inputs, outputs, tick]);
    return (_jsxs("div", { className: "w-full h-full relative overflow-hidden", style: {
            background: `
          radial-gradient(circle at 50% 50%, #0a1520 0%, #050a10 100%)
        `,
        }, children: [_jsx("div", { className: "absolute inset-0 opacity-20 pointer-events-none", style: {
                    backgroundImage: `
            linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '20px 20px',
                } }), _jsx("div", { className: "absolute inset-4", children: circuitContent }), _jsx("div", { className: "absolute top-2 right-2 px-2 py-0.5 rounded border border-gray-800 bg-black/40 text-[9px] font-mono text-gray-600 pointer-events-none select-none", children: "VIEW ONLY" }), _jsx("div", { className: "absolute inset-0 pointer-events-none border border-[#1a3a2a] rounded-lg" }), _jsx("div", { className: "absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00ff8844] to-transparent" }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00ff8844] to-transparent" })] }));
};
export default CircuitCanvas;
