import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
// --- Arduino Pin Definitions ---
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const DIGITAL_PINS = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
const PWM_PINS = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11']; // Subset of Digital
export const ArduinoInstrument = ({ signalToPinMap, availableSignals, pinValues, onMapSignal, onSetPinOutput, onCaptureSnapshot }) => {
    // Local State for Plot
    const [selectedPlotPin, setSelectedPlotPin] = useState(null);
    const [plotHistory, setPlotHistory] = useState([]);
    // Invert Map for easier lookup: Pin -> Signal
    const pinToSignalMap = useMemo(() => {
        const map = {};
        Object.entries(signalToPinMap).forEach(([sig, pin]) => map[pin] = sig);
        return map;
    }, [signalToPinMap]);
    // Update Plot History
    useEffect(() => {
        if (!selectedPlotPin)
            return;
        const val = pinValues[selectedPlotPin];
        const numVal = typeof val === 'boolean' ? (val ? 1 : 0) : (typeof val === 'number' ? val : 0);
        setPlotHistory(prev => {
            const next = [...prev, numVal];
            if (next.length > 50)
                next.shift(); // Keep last 50 points
            return next;
        });
    }, [pinValues, selectedPlotPin]); // Dependent on parent tick rate
    // Helper to render Pin Row
    const renderPinRow = (pin, type) => {
        const mappedSignal = pinToSignalMap[pin];
        const isPWM = PWM_PINS.includes(pin);
        // Value Display
        const rawVal = pinValues[pin];
        let displayVal = '—';
        if (rawVal !== undefined) {
            if (typeof rawVal === 'boolean')
                displayVal = rawVal ? 'HIGH' : 'LOW';
            else
                displayVal = rawVal.toFixed(2);
        }
        // Determine Direction based on mapped signal type? Or allow user to set Mode?
        // For v1: 
        // Analog: Inputs TO Arduino (Read circuit)
        // Digital: Configurable? Let's assume Digital can be Output (Drive Circuit) or Input (Read Circuit).
        // For simplicity: If we map a Circuit Input -> Pin, Pin is Output. If Circuit Output -> Pin, Pin is Input.
        // We can infer from availableSignals lists.
        const isDrivingCircuit = mappedSignal && availableSignals.inputs.some(s => s.label === mappedSignal);
        return (_jsxs("div", { className: `flex items-center justify-between p-2 rounded border border-gray-800 bg-gray-900/50 text-xs ${selectedPlotPin === pin ? 'border-cyan-500/50 bg-cyan-900/20' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2 w-16 cursor-pointer hover:text-cyan-400 font-mono font-bold text-gray-400", onClick: () => { setSelectedPlotPin(pin); setPlotHistory([]); }, children: [_jsx("div", { className: `w-2 h-2 rounded-full ${selectedPlotPin === pin ? 'bg-cyan-400' : 'bg-gray-700'}` }), pin] }), _jsxs("select", { className: "bg-black border border-gray-700 rounded text-gray-300 w-32 text-[10px] outline-none focus:border-blue-500", value: mappedSignal || '', onChange: (e) => onMapSignal(e.target.value, pin), "aria-label": `Map Channel ${pin}`, children: [_jsx("option", { value: "", children: "(Unconnected)" }), type === 'ANALOG' && (_jsx("optgroup", { label: "Measure (Circuit Outputs)", children: availableSignals.outputs.map(s => _jsx("option", { value: s.label, children: s.label }, s.id)) })), type !== 'ANALOG' && (_jsxs(_Fragment, { children: [_jsx("optgroup", { label: "Drive (Circuit Inputs)", children: availableSignals.inputs.map(s => _jsx("option", { value: s.label, children: s.label }, s.id)) }), _jsx("optgroup", { label: "Measure (Circuit Outputs)", children: availableSignals.outputs.map(s => _jsx("option", { value: s.label, children: s.label }, s.id)) })] }))] }), _jsxs("div", { className: "w-24 flex justify-end gap-2 items-center", children: [isDrivingCircuit && (_jsx(_Fragment, { children: isPWM ? (_jsx("input", { type: "range", min: "0", max: "1", step: "0.1", className: "w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer", onChange: (e) => onSetPinOutput(pin, parseFloat(e.target.value)), "aria-label": `PWM Control for ${pin}` })) : (_jsx("button", { className: `px-2 py-0.5 rounded text-[10px] font-bold ${pinValues[pin] ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`, onClick: () => onSetPinOutput(pin, pinValues[pin] ? 0 : 1), children: pinValues[pin] ? 'HIGH' : 'LOW' })) })), !isDrivingCircuit && (_jsx("span", { className: "font-mono text-cyan-300", children: displayVal }))] })] }, pin));
    };
    return (_jsxs("div", { className: "flex w-full h-full bg-gray-950 gap-px", children: [_jsxs("div", { className: "w-1/2 flex flex-col border-r border-gray-800 bg-gray-900/30", children: [_jsxs("div", { className: "p-3 border-b border-gray-800 flex justify-between items-center", children: [_jsx("h2", { className: "text-sm font-bold text-gray-300 uppercase tracking-wider", children: "IO Channels" }), _jsxs("div", { className: "text-[10px] bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-900/50 flex items-center gap-1", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" }), "Device Active"] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-2 space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-bold text-gray-500 mb-2 uppercase px-1", children: "Analog Inputs (Measure)" }), _jsx("div", { className: "space-y-1", children: ANALOG_PINS.map(pin => renderPinRow(pin, 'ANALOG')) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-bold text-gray-500 mb-2 uppercase px-1", children: "Digital I/O" }), _jsx("div", { className: "space-y-1", children: DIGITAL_PINS.map(pin => renderPinRow(pin, 'DIGITAL')) })] })] })] }), _jsxs("div", { className: "w-1/2 flex flex-col bg-black", children: [_jsxs("div", { className: "flex-1 p-4 relative overflow-hidden flex flex-col", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-gray-400 text-xs font-bold uppercase", children: "Live Signal Plot" }), _jsx("div", { className: "text-cyan-400 font-mono text-sm", children: selectedPlotPin ? `${selectedPlotPin} → ${pinToSignalMap[selectedPlotPin] || 'Unmapped'}` : 'No Channel Selected' })] }), _jsxs("button", { onClick: onCaptureSnapshot, className: "bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-3 py-1.5 rounded border border-gray-600 flex items-center gap-2 transition-colors", children: [_jsx("div", { className: "w-2 h-2 bg-red-500 rounded-full" }), "Capture Snapshot"] })] }), _jsx("div", { className: "flex-1 border border-gray-800 rounded bg-gray-900/50 relative", children: selectedPlotPin && plotHistory.length > 1 ? (_jsxs("svg", { className: "absolute inset-0 w-full h-full", preserveAspectRatio: "none", children: [_jsx("line", { x1: "0", y1: "50%", x2: "100%", y2: "50%", stroke: "#333", strokeDasharray: "4 4" }), _jsx("polyline", { points: plotHistory.map((val, i) => {
                                                const x = (i / 49) * 100 + '%';
                                                const y = (1 - val) * 100 + '%'; // Assuming normalized 0-1 range for bool/PWM
                                                return `${x},${y}`;
                                            }).join(' '), fill: "none", stroke: "#06b6d4", strokeWidth: "2", vectorEffect: "non-scaling-stroke" })] })) : (_jsx("div", { className: "absolute inset-0 flex items-center justify-center text-gray-700 text-xs text-center p-8", children: "Select a channel on the left to confirm data stream." })) }), _jsxs("div", { className: "mt-4 flex gap-4 text-xs font-mono text-gray-500", children: [_jsxs("div", { children: ["SAMPLES: ", plotHistory.length] }), _jsx("div", { children: "RATE: SIM_TICK" })] })] }), _jsxs("div", { className: "h-32 border-t border-gray-800 p-2 font-mono text-[10px] text-gray-400 overflow-y-auto", children: [_jsx("div", { className: "text-gray-600 mb-1", children: "EVENT LOG" }), _jsx("div", { children: "> Instrument initialized (Virtual)" }), pinToSignalMap['D13'] && _jsxs("div", { children: ["> D13 mapped to ", pinToSignalMap['D13']] })] })] })] }));
};
