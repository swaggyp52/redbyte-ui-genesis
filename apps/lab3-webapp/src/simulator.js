import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useLabStore } from './store';
import { BasysBoard } from './basys-board';
import { BasysBoardMulti } from './basys-board-multi';
import { Play, Pause, SkipForward, RotateCcw, CheckCircle2, AlertCircle, LayoutGrid } from 'lucide-react';
import useNewLabStore from './store/labStore';
export const Simulator = () => {
    const simulationInput = useLabStore((s) => s.simulationInput);
    const setSimulationInput = useLabStore((s) => s.setSimulationInput);
    const runAllVectors = useLabStore((s) => s.runAllVectors);
    const evalSeg = useLabStore((s) => s.evalSeg);
    const validationResults = useLabStore((s) => s.validationResults);
    const emitEvent = useNewLabStore((s) => s.emitEvent);
    const [isAnimating, setIsAnimating] = useState(false);
    const [autoRunning, setAutoRunning] = useState(false);
    const [multiDigitMode, setMultiDigitMode] = useState(false);
    const currentOutput = evalSeg(simulationInput);
    const currentSeg = [
        ((currentOutput >> 0) & 1),
        ((currentOutput >> 1) & 1),
        ((currentOutput >> 2) & 1),
        ((currentOutput >> 3) & 1),
        ((currentOutput >> 4) & 1),
        ((currentOutput >> 5) & 1),
        ((currentOutput >> 6) & 1),
    ];
    const switches = [
        ((simulationInput >> 3) & 1) === 1,
        ((simulationInput >> 2) & 1) === 1,
        ((simulationInput >> 1) & 1) === 1,
        ((simulationInput >> 0) & 1) === 1,
    ];
    const handleSwitchToggle = (bit) => {
        setIsAnimating(true);
        const newVal = ((simulationInput >> bit) & 1) === 1
            ? simulationInput & ~(1 << bit)
            : simulationInput | (1 << bit);
        setSimulationInput(newVal);
        // Emit sim.vectorRun event
        const newOutput = evalSeg(newVal);
        emitEvent('sim.vectorRun', {
            vectorIndex: newVal,
            results: {
                output: newOutput,
                segments: [
                    ((newOutput >> 0) & 1),
                    ((newOutput >> 1) & 1),
                    ((newOutput >> 2) & 1),
                    ((newOutput >> 3) & 1),
                    ((newOutput >> 4) & 1),
                    ((newOutput >> 5) & 1),
                    ((newOutput >> 6) & 1),
                ],
            },
        });
        setTimeout(() => setIsAnimating(false), 200);
    };
    const handleNext = () => {
        setIsAnimating(true);
        const nextVal = (simulationInput + 1) % 16;
        setSimulationInput(nextVal);
        // Emit sim.vectorRun event
        const newOutput = evalSeg(nextVal);
        emitEvent('sim.vectorRun', {
            vectorIndex: nextVal,
            results: {
                output: newOutput,
                segments: [
                    ((newOutput >> 0) & 1),
                    ((newOutput >> 1) & 1),
                    ((newOutput >> 2) & 1),
                    ((newOutput >> 3) & 1),
                    ((newOutput >> 4) & 1),
                    ((newOutput >> 5) & 1),
                    ((newOutput >> 6) & 1),
                ],
            },
        });
        setTimeout(() => setIsAnimating(false), 200);
    };
    const handleReset = () => {
        setIsAnimating(true);
        setSimulationInput(0);
        setTimeout(() => setIsAnimating(false), 200);
    };
    // Auto-run functionality
    useEffect(() => {
        if (autoRunning) {
            const interval = setInterval(() => {
                setSimulationInput((simulationInput + 1) % 16);
            }, 800);
            return () => clearInterval(interval);
        }
    }, [autoRunning, setSimulationInput, simulationInput]);
    const passCount = validationResults.filter((r) => r.pass).length;
    const hasRun = validationResults.length > 0;
    const allPassed = hasRun && passCount === validationResults.length;
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2", children: "Interactive Simulator" }), _jsx("p", { className: "font-digital text-sm text-slate-400", children: "Test your seven-segment logic with animated signal propagation" })] }), _jsxs("button", { onClick: () => setMultiDigitMode(!multiDigitMode), className: `px-4 py-2 rounded-lg font-tech font-semibold transition-all duration-200 flex items-center gap-2 ${multiDigitMode
                                ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white glow-box-cyan'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`, title: "Toggle 4-digit multiplexed display", children: [_jsx(LayoutGrid, { size: 18 }), multiDigitMode ? '4-Digit Mode' : 'Single Digit'] })] }) }), multiDigitMode ? (_jsx(BasysBoardMulti, { switches: switches, segments: currentSeg, onSwitchToggle: handleSwitchToggle, inputValue: simulationInput, enableMultiplexing: true })) : (_jsx(BasysBoard, { switches: switches, segments: currentSeg, onSwitchToggle: handleSwitchToggle, inputValue: simulationInput })), _jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsxs("h3", { className: "font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), "Simulation Controls"] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "text-sm font-digital text-slate-400 mb-2", children: "Manual Control:" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setAutoRunning(!autoRunning), className: `flex-1 py-3 px-4 rounded-lg font-tech font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${autoRunning
                                                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white glow-box-amber'
                                                    : 'bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white glow-box-cyan'}`, title: autoRunning ? 'Pause auto-increment' : 'Auto-increment through inputs', children: autoRunning ? _jsxs(_Fragment, { children: [_jsx(Pause, { size: 18 }), " Pause"] }) : _jsxs(_Fragment, { children: [_jsx(Play, { size: 18 }), " Auto Run"] }) }), _jsx("button", { onClick: handleNext, disabled: autoRunning, className: "py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-tech font-semibold transition-all duration-200 flex items-center gap-2", title: "Next input (+1)", children: _jsx(SkipForward, { size: 18 }) }), _jsx("button", { onClick: handleReset, disabled: autoRunning, className: "py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-tech font-semibold transition-all duration-200 flex items-center gap-2", title: "Reset to 0", children: _jsx(RotateCcw, { size: 18 }) })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "text-sm font-digital text-slate-400 mb-2", children: "Full Validation:" }), _jsxs("button", { onClick: runAllVectors, className: "w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-tech font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 glow-box-emerald", title: "Test all 16 input combinations", children: [_jsx(Play, { size: 18 }), "Run All 16 Tests"] })] })] })] }), hasRun && (_jsxs("div", { className: `border rounded-xl p-6 ${allPassed
                    ? 'bg-emerald-950/30 border-emerald-500/30'
                    : 'bg-red-950/30 border-red-500/30'}`, children: [_jsx("div", { className: "flex items-center gap-3 mb-4", children: allPassed ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { size: 24, className: "text-emerald-400" }), _jsxs("div", { children: [_jsx("h3", { className: "font-tech-display text-lg font-bold text-emerald-400", children: "All Tests Passed! \u2713" }), _jsx("p", { className: "font-digital text-sm text-emerald-300", children: "Your circuit correctly implements the seven-segment decoder" })] })] })) : (_jsxs(_Fragment, { children: [_jsx(AlertCircle, { size: 24, className: "text-red-400" }), _jsxs("div", { children: [_jsxs("h3", { className: "font-tech-display text-lg font-bold text-red-400", children: [passCount, "/", validationResults.length, " Tests Passed"] }), _jsx("p", { className: "font-digital text-sm text-red-300", children: "Some inputs produce incorrect segment patterns" })] })] })) }), _jsx("div", { className: "grid grid-cols-4 sm:grid-cols-8 gap-2", children: validationResults.map((r, i) => (_jsx("div", { className: `p-2 rounded-lg text-center font-digital text-sm transition-all duration-200 ${r.pass
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'}`, title: r.pass ? `Input ${i}: Correct` : `Input ${i}: Expected ${r.expected}, got ${r.actual}`, children: i }, i))) })] }))] }));
};
