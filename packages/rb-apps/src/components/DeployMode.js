import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import { Basys3BoardView } from './boards/Basys3BoardView';
import { ArduinoInstrument } from './boards/ArduinoInstrument';
import { getSignalValue, getAvailableSignals } from '@redbyte/rb-lab-engine';
export const DeployMode = () => {
    const { project, dispatch } = useLabEngineStore();
    // Local UI state
    const [inspectorLed, setInspectorLed] = useState(null);
    // 1. Ensure Profile Exists (Default to Basys3 if empty)
    useEffect(() => {
        if (!project)
            return;
        if (!project.boardMap?.boardProfileId) {
            dispatch({
                v: 1,
                t: 'board/setProfile',
                p: { profileId: 'basys3' },
            });
        }
    }, [project?.boardMap?.boardProfileId, dispatch]);
    // 2. Tick Policy
    useEffect(() => {
        if (project) {
            dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
        }
    }, []);
    useEffect(() => {
        if (project && project.boardMap?.signalToPinMap) {
            dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
        }
    }, [project?.boardMap?.signalToPinMap, dispatch]);
    // 3. Data Extraction & Logic
    const boardId = project?.boardMap?.boardProfileId || 'basys3';
    // Basys3 Specifics
    const signalToPinMap = useMemo(() => project?.boardMap?.signalToPinMap ?? {}, [project?.boardMap?.signalToPinMap]);
    const switchesIO = useMemo(() => project?.boardMap?.virtualIOState?.switches ?? Array(16).fill(false), [project?.boardMap?.virtualIOState?.switches]);
    const buttons = useMemo(() => {
        const arr = project?.boardMap?.virtualIOState?.buttons ?? Array(5).fill(false);
        return {
            BTNC: arr[0], BTNU: arr[1], BTNL: arr[2], BTNR: arr[3], BTND: arr[4]
        };
    }, [project?.boardMap?.virtualIOState?.buttons]);
    // Mapped Logic (Basys3)
    const basys3Mapped = useMemo(() => {
        const sw = {};
        const ld = {};
        Object.entries(signalToPinMap).forEach(([signal, pin]) => {
            if (pin.startsWith('SW')) {
                const idx = parseInt(pin.replace('SW', ''));
                if (!isNaN(idx))
                    sw[idx] = signal;
            }
            else if (pin.startsWith('LD')) {
                const idx = parseInt(pin.replace('LD', ''));
                if (!isNaN(idx))
                    ld[idx] = signal;
            }
        });
        return { switches: sw, leds: ld, buttons: {} };
    }, [signalToPinMap]);
    // LED States (Basys3)
    const leds = useMemo(() => {
        const states = Array(16).fill(false);
        if (!project)
            return states;
        Object.entries(basys3Mapped.leds).forEach(([idxStr, signal]) => {
            const idx = parseInt(idxStr);
            const val = getSignalValue(project, signal);
            if (val !== undefined)
                states[idx] = val;
        });
        return states;
    }, [project, basys3Mapped.leds]);
    // Arduino Specifics: Pin Values
    // We need to resolve all mapped pins to their signal values for the instrument
    const arduinoPinValues = useMemo(() => {
        const values = {};
        if (boardId === 'arduino') {
            Object.entries(signalToPinMap).forEach(([signal, pin]) => {
                const val = getSignalValue(project, signal);
                if (val !== undefined)
                    values[pin] = val;
            });
        }
        return values;
    }, [project, boardId, signalToPinMap]);
    // 7. Filter Signals
    const availableSignals = useMemo(() => {
        return getAvailableSignals(project);
    }, [project?.circuit.nodes]);
    // --- Actions ---
    const handleSetProfile = (id) => {
        dispatch({ v: 1, t: 'board/setProfile', p: { profileId: id } });
    };
    const handleToggleSwitch = (index) => {
        const newSwitches = [...switchesIO];
        newSwitches[index] = !newSwitches[index];
        dispatch({ v: 1, t: 'board/setSwitches', p: { switches: newSwitches } });
        dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
    };
    const handlePressButton = (id, down) => { }; // TODO
    const handleMapSignal = (signal, pin) => {
        dispatch({ v: 1, t: 'board/mapSignal', p: { signal, pin } });
    };
    // Arduino: Set Output (Drive Circuit)
    const handleSetPinOutput = (pin, value) => {
        // This requires virtual IO support for generic pins in the reducer? 
        // For now, Basys3 reducer uses specific 'switches' array. 
        // Arduino might need a generic 'io' record or we map D-pins to switches array?
        // Reuse Switches Array for Arduino Digital Pins?
        // D0-D13 -> Switches 0-13?
        // Hacky but works for v1 if documented.
        // Let's assume D0-D15 maps to Switches 0-15 for storage simplification in MVP
        if (pin.startsWith('D')) {
            const idx = parseInt(pin.slice(1));
            if (!isNaN(idx) && idx < 16) {
                const newSwitches = [...switchesIO];
                newSwitches[idx] = !!value; // Boolean force for now
                dispatch({ v: 1, t: 'board/setSwitches', p: { switches: newSwitches } });
                dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
            }
        }
    };
    const handleCaptureSnapshot = () => {
        // Construct compliant EvidenceSnapshot
        const snapshot = {
            timestamp: new Date().toISOString(),
            tick: project.simulation.currentTick,
            probeValues: {}, // TODO: Capture probes if relevant
            circuitHash: 'PENDING', // Compute if necessary
            projectHash: 'PENDING',
            boardState: {
                leds: leds.map(l => !!l),
                switches: switchesIO.map(s => !!s),
                pinValues: boardId === 'arduino' ? arduinoPinValues : undefined
            }
        };
        dispatch({ v: 1, t: 'evidence/addSnapshot', p: snapshot });
    };
    if (!project)
        return _jsx("div", { children: "Loading..." });
    const currentInspectorValue = inspectorLed !== null ? getSignalValue(project, basys3Mapped.leds[inspectorLed] ?? '') : undefined;
    return (_jsxs("div", { className: "flex flex-col h-full bg-gray-950 text-gray-200", children: [_jsxs("div", { className: "h-12 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between shrink-0", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h2", { className: "font-bold text-sm tracking-wide text-gray-400 uppercase", children: "Deploy Target" }), _jsxs("select", { className: "bg-black border border-gray-600 rounded text-gray-200 text-xs px-2 py-1", value: boardId, onChange: (e) => handleSetProfile(e.target.value), "aria-label": "Select Board Profile", children: [_jsx("option", { value: "basys3", children: "Basys3 (FPGA)" }), _jsx("option", { value: "arduino", children: "Arduino Uno (MCU)" })] })] }), _jsx("div", { children: _jsx("span", { className: "text-xs text-green-500 font-mono", children: "SIMULATION ACTIVE" }) })] }), _jsx("div", { className: "flex-1 min-h-0 relative", children: boardId === 'basys3' ? (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-80 flex flex-col border-r border-gray-800 bg-gray-900 shrink-0", children: [_jsx("div", { className: "p-4 border-b border-gray-800", children: _jsx("h2", { className: "font-bold text-sm tracking-wide text-gray-400 uppercase", children: "IO Mapping" }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-2 space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-xs font-semibold text-gray-500 uppercase px-2 mb-1 flex items-center justify-between", children: [_jsx("span", { children: "Circuit Signals" }), _jsx("span", { className: "text-gray-600", children: "\u2192 Board LEDs" })] }), availableSignals.outputs.filter(n => n.label || n.type === 'LED' || n.type === 'OUTPUT').map(sig => {
                                                    const mappedPin = signalToPinMap[sig.label];
                                                    return (_jsxs("div", { className: "flex items-center justify-between text-xs bg-gray-800 p-2 rounded border border-gray-700 hover:border-gray-600 transition-colors", children: [_jsx("div", { className: "font-mono text-blue-300 truncate max-w-[100px]", title: sig.label, children: sig.label }), _jsx("div", { className: "text-gray-500", children: "\u2192" }), _jsxs("select", { className: `bg-black border rounded text-gray-300 w-24 text-[10px] focus:ring-1 focus:ring-blue-500 outline-none ${mappedPin ? 'border-blue-500/50' : 'border-gray-600'}`, value: mappedPin || '', onChange: (e) => handleMapSignal(sig.label, e.target.value), children: [_jsx("option", { value: "", children: "(Unmapped)" }), _jsx("optgroup", { label: "LEDs", children: Array.from({ length: 16 }).map((_, i) => (_jsxs("option", { value: `LD${i}`, children: ["LD", i] }, `LD${i}`))) })] })] }, sig.id));
                                                })] }), _jsx("div", { className: "h-px bg-gray-800 my-2" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-xs font-semibold text-gray-500 uppercase px-2 mb-1 flex items-center justify-between", children: [_jsx("span", { children: "Circuit Inputs" }), _jsx("span", { className: "text-gray-600", children: "\u2190 Board Switches" })] }), availableSignals.inputs.map(sig => {
                                                    const mappedPin = signalToPinMap[sig.label];
                                                    return (_jsxs("div", { className: "flex items-center justify-between text-xs bg-gray-800 p-2 rounded border border-gray-700 hover:border-gray-600 transition-colors", children: [_jsx("div", { className: "font-mono text-green-300 truncate max-w-[100px]", title: sig.label, children: sig.label }), _jsx("div", { className: "text-gray-500", children: "\u2190" }), _jsxs("select", { className: `bg-black border rounded text-gray-300 w-24 text-[10px] focus:ring-1 focus:ring-green-500 outline-none ${mappedPin ? 'border-green-500/50' : 'border-gray-600'}`, value: mappedPin || '', onChange: (e) => handleMapSignal(sig.label, e.target.value), children: [_jsx("option", { value: "", children: "(Unmapped)" }), _jsx("optgroup", { label: "Switches", children: Array.from({ length: 16 }).map((_, i) => (_jsxs("option", { value: `SW${i}`, children: ["SW", i] }, `SW${i}`))) })] })] }, sig.id));
                                                }), availableSignals.inputs.length === 0 && (_jsx("div", { className: "text-xs text-center text-gray-600 py-4 italic", children: "No Switch/Input components found." }))] })] })] }), _jsxs("div", { className: "flex-1 flex flex-col relative bg-gray-950 overflow-hidden shadow-inner", children: [_jsx(Basys3BoardView, { switches: switchesIO, leds: leds, buttons: buttons, mappedSignals: basys3Mapped, onToggleSwitch: handleToggleSwitch, onPressButton: handlePressButton, onInspectLED: (idx) => setInspectorLed(idx) }), inspectorLed !== null && (_jsxs("div", { className: "absolute top-6 right-6 bg-gray-900 border border-gray-700 p-4 rounded-lg shadow-2xl w-72 z-20 backdrop-blur-sm bg-gray-900/95", children: [_jsxs("div", { className: "flex justify-between items-start mb-3", children: [_jsx("h3", { className: "font-bold text-gray-200 text-sm", children: "Signal Inspector" }), _jsx("button", { onClick: () => setInspectorLed(null), className: "text-gray-500 hover:text-white transition-colors", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M1 1l12 12M13 1l-12 12" }) }) })] }), _jsxs("div", { className: "space-y-3 text-xs", children: [_jsxs("div", { className: "flex justify-between border-b border-gray-800 pb-2", children: [_jsx("span", { className: "text-gray-500 font-medium", children: "PIN" }), _jsxs("span", { className: "font-mono text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded", children: ["LD", inspectorLed] })] }), _jsxs("div", { className: "flex justify-between border-b border-gray-800 pb-2", children: [_jsx("span", { className: "text-gray-500 font-medium", children: "MAPPED SIGNAL" }), _jsx("span", { className: `font-mono px-1.5 py-0.5 rounded ${basys3Mapped.leds[inspectorLed] ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 italic'}`, children: basys3Mapped.leds[inspectorLed] || 'Unconnected' })] }), _jsxs("div", { className: "flex justify-between items-center pt-1", children: [_jsx("span", { className: "text-gray-500 font-medium", children: "LOGIC STATE" }), _jsx("span", { className: `font-bold px-2 py-1 rounded flex items-center gap-2 ${currentInspectorValue === true ? 'text-green-400 bg-green-900/30' :
                                                                currentInspectorValue === false ? 'text-gray-400 bg-gray-800' :
                                                                    'text-amber-500 bg-amber-900/30'}`, children: currentInspectorValue === true ? (_jsxs(_Fragment, { children: [_jsx("span", { children: "HIGH" }), " ", _jsx("span", { children: "(1)" })] })) : currentInspectorValue === false ? (_jsxs(_Fragment, { children: [_jsx("span", { children: "LOW" }), " ", _jsx("span", { children: "(0)" })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "UNKNOWN" }), " ", _jsx("span", { className: "text-[10px] opacity-75", children: "?" })] })) })] }), currentInspectorValue === undefined && basys3Mapped.leds[inspectorLed] && (_jsx("div", { className: "mt-2 text-[10px] text-amber-500/80 bg-amber-900/20 p-2 rounded", children: "Signal path unresolved. Ensure simulation is running and node has valid state." }))] })] }))] })] })) : (
                /* Arduino View */
                _jsx(ArduinoInstrument, { signalToPinMap: signalToPinMap, availableSignals: availableSignals, pinValues: arduinoPinValues, onMapSignal: handleMapSignal, onSetPinOutput: handleSetPinOutput, onCaptureSnapshot: handleCaptureSnapshot })) })] }));
};
