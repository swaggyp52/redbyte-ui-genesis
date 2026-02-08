import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { BASYS3_WIDTH, BASYS3_HEIGHT, SWITCH_POSITIONS, LED_POSITIONS, BUTTON_POSITIONS } from './Basys3Layout';
export const Basys3BoardView = ({ width = 800, height = 500, switches, leds, buttons, mappedSignals, onToggleSwitch, onPressButton, onInspectLED }) => {
    // Internal tooltip state
    const [hoveredElement, setHoveredElement] = useState(null);
    // Scaling to fit container
    const viewBox = `0 0 ${BASYS3_WIDTH} ${BASYS3_HEIGHT}`;
    return (_jsxs("div", { className: "relative w-full h-full flex items-center justify-center bg-gray-900 overflow-hidden select-none", children: [_jsxs("svg", { viewBox: viewBox, className: "w-full h-full max-w-4xl max-h-[80vh]", style: { filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))' }, children: [_jsx("rect", { x: 20, y: 20, width: BASYS3_WIDTH - 40, height: BASYS3_HEIGHT - 40, rx: 15, fill: "#1a4731" // PCB Green
                        , stroke: "#113022", strokeWidth: 4 }), _jsx("text", { x: BASYS3_WIDTH / 2, y: 80, textAnchor: "middle", fill: "#aaa", fontFamily: "monospace", fontSize: 24, fontWeight: "bold", children: "BASYS3 VIRTUAL" }), Object.entries(SWITCH_POSITIONS).map(([idxStr, pos]) => {
                        const i = parseInt(idxStr);
                        const isOn = switches[i];
                        const signal = mappedSignals.switches[i];
                        return (_jsxs("g", { transform: `translate(${pos.x}, ${pos.y})`, onClick: () => onToggleSwitch(i), onMouseEnter: () => setHoveredElement({ type: 'SWITCH', index: i, x: pos.x, y: pos.y }), onMouseLeave: () => setHoveredElement(null), style: { cursor: 'pointer' }, children: [_jsxs("text", { y: 35, textAnchor: "middle", fill: "#888", fontSize: 10, fontFamily: "monospace", children: ["SW", i] }), _jsx("rect", { x: -10, y: -20, width: 20, height: 40, fill: "#333", stroke: "#111" }), _jsx("rect", { x: -8, y: isOn ? -25 : -5, width: 16, height: 25, fill: "#ddd", rx: 2, style: { transition: 'y 0.1s ease-out' } }), signal && (_jsx("circle", { cx: 0, cy: 25, r: 2, fill: "#3b82f6", opacity: 0.8 }))] }, `sw-${i}`));
                    }), Object.entries(LED_POSITIONS).map(([idxStr, pos]) => {
                        const i = parseInt(idxStr);
                        const isLit = leds[i];
                        const signal = mappedSignals.leds[i];
                        return (_jsxs("g", { transform: `translate(${pos.x}, ${pos.y})`, onClick: () => onInspectLED(i), onMouseEnter: () => setHoveredElement({ type: 'LED', index: i, x: pos.x, y: pos.y }), onMouseLeave: () => setHoveredElement(null), style: { cursor: 'pointer' }, children: [_jsxs("text", { y: -20, textAnchor: "middle", fill: "#888", fontSize: 10, fontFamily: "monospace", children: ["LD", i] }), _jsx("rect", { x: -5, y: -5, width: 10, height: 10, fill: "#222" }), _jsx("circle", { r: isLit ? 6 : 4, fill: isLit ? '#22c55e' : '#1e3a2a', stroke: isLit ? '#4ade80' : '#111', strokeWidth: isLit ? 2 : 1 }), isLit && (_jsx("circle", { r: 10, fill: "url(#led-glow)", opacity: 0.6, pointerEvents: "none" }))] }, `led-${i}`));
                    }), Object.entries(BUTTON_POSITIONS).map(([id, pos]) => {
                        const isPressed = buttons[id];
                        return (_jsxs("g", { transform: `translate(${pos.x}, ${pos.y})`, onMouseDown: () => onPressButton(id, true), onMouseUp: () => onPressButton(id, false), onMouseLeave: () => onPressButton(id, false), style: { cursor: 'pointer' }, children: [_jsx("circle", { r: 18, fill: "#222", stroke: "#111", strokeWidth: 2 }), _jsx("circle", { r: 14, fill: isPressed ? "#444" : "#111" }), _jsx("text", { y: 4, textAnchor: "middle", fill: "#666", fontSize: 10, pointerEvents: "none", children: pos.label })] }, id));
                    }), _jsx("defs", { children: _jsxs("radialGradient", { id: "led-glow", children: [_jsx("stop", { offset: "0%", stopColor: "#22c55e", stopOpacity: "0.8" }), _jsx("stop", { offset: "100%", stopColor: "#22c55e", stopOpacity: "0" })] }) })] }), hoveredElement && (_jsxs("div", { className: "absolute pointer-events-none bg-black/90 text-white text-xs px-2 py-1 rounded border border-gray-700 shadow-xl z-50 flex flex-col gap-0.5", style: {
                    // Simplified positioning logic (center screen usually, but let's try to track projected position if possible)
                    // Since SVG scales, exact pixel tracking is hard without `getBoundingClientRect`.
                    // For a board view, a fixed display in corner is often cleaner than a floating tooltip.
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)'
                }, children: [_jsxs("div", { className: "font-bold text-gray-400 uppercase tracking-wider", children: [hoveredElement.type, " ", hoveredElement.index] }), hoveredElement.type === 'SWITCH' && (_jsxs("div", { children: ["Signal: ", _jsx("span", { className: "text-blue-400", children: mappedSignals.switches[hoveredElement.index] || 'Unmapped' }), _jsx("span", { className: "mx-2 text-gray-600", children: "|" }), "Value: ", _jsx("span", { className: switches[hoveredElement.index] ? 'text-green-400' : 'text-gray-400', children: switches[hoveredElement.index] ? '1 (ON)' : '0 (OFF)' })] })), hoveredElement.type === 'LED' && (_jsxs("div", { children: ["Signal: ", _jsx("span", { className: "text-blue-400", children: mappedSignals.leds[hoveredElement.index] || 'Unmapped' }), _jsx("span", { className: "mx-2 text-gray-600", children: "|" }), "State: ", _jsx("span", { className: leds[hoveredElement.index] ? 'text-green-400' : 'text-gray-400', children: leds[hoveredElement.index] ? 'HIGH' : 'LOW' })] }))] }))] }));
};
