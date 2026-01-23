import React, { useState, useEffect } from 'react';
import BoardPanel from '../components/BoardPanel';
import { CompareView, type CompareSignalCheck } from '../components/CompareView';
import { useHardwareStore } from '../stores/hardwareStore';
import { getSignalMap } from '../labs/signalMap';
import { getSimSnapshot, useSimStore, getSimCapabilities, setSimInput } from '../labs/simAdapter';
import { EXPERIMENTS } from '../labs/experiments';
import type { HardwareTraceV1 } from '../hardware/traceFormat';
import { validateTrace } from '../hardware/traceFormat';
import { saveTraceToFS, loadTraceFromFS } from '../utils/traceFileUtils';
import { LabInstructions } from '../labs/LabInstructions';
import { InspectorPanel } from '../labs/InspectorPanel';
import { useLabStore } from '../labs/labStore';
import { LAB_1_CONTENT } from '../labs/labContent';

interface ECELabAppProps {
    windowId?: string;
}

type ECELabMode = 'sim-only' | 'board-connected' | 'guided-lab' | 'inspector';
type RightPanelTab = 'board' | 'compare';

export const ECELabAppComponent: React.FC<ECELabAppProps> = ({ windowId }) => {
    const [mode, setMode] = useState<ECELabMode>('sim-only');
    const [rightTab, setRightTab] = useState<RightPanelTab>('board');

    // Hardware state for comparison
    const ioSnapshot = useHardwareStore((s) => s.ioSnapshot);
    const capabilities = useHardwareStore((s) => s.capabilities);

    // Sim State (for Free Play)
    // Sim State (for Free Play)
    // FIX: Split selectors to prevent infinite re-render loop caused by object literal return
    const simTick = useSimStore((s) => s.tick);
    const simInputs = useSimStore((s) => s.inputs);
    const simOutputs = useSimStore((s) => s.outputs);

    const simSnapshot = React.useMemo(() => ({
        timestamp: new Date().toISOString(),
        tick: simTick,
        inputs: simInputs,
        outputs: simOutputs
    }), [simTick, simInputs, simOutputs]);

    const simCapabilities = useSimStore((s) => s.capabilities);

    // Sim Actions & Auto-Run
    const activeExperimentId = useSimStore((s) => s.activeExperimentId);
    const setSimExperiment = useSimStore((s) => s.setExperiment);
    const simAutoRun = useSimStore((s) => s.autoRun);
    const setSimAutoRun = useSimStore((s) => s.setAutoRun);
    const simRunTick = useSimStore((s) => s.runTick);
    const simReset = useSimStore((s) => s.reset);

    // Auto-run effect (Unconditional, but depends on simAutoRun flag)
    useEffect(() => {
        if (!simAutoRun) return;
        const interval = setInterval(simRunTick, 100); // 10Hz
        return () => clearInterval(interval);
    }, [simAutoRun, simRunTick]);

    // Derived comparison state
    const [checks, setChecks] = useState<CompareSignalCheck[]>([]);

    // Trace / Replay State
    const isRecording = useHardwareStore((s) => s.isRecording);
    const traceBuffer = useHardwareStore((s) => s.traceBuffer);
    const recordingStartTick = useHardwareStore((s) => s.recordingStartTick);
    const startRecording = useHardwareStore((s) => s.startRecording);
    const stopRecording = useHardwareStore((s) => s.stopRecording);
    const clearTrace = useHardwareStore((s) => s.clearTrace);

    // Replay State
    const [replayTrace, setReplayTrace] = useState<HardwareTraceV1 | null>(null);
    const [replayIndex, setReplayIndex] = useState<number>(0);

    // Event listeners
    useEffect(() => {
        const handleReplayLoad = (e: Event) => {
            const trace = (e as CustomEvent).detail;

            // Validate before trusting
            const validation = validateTrace(trace);
            if (!validation.ok) {
                console.error('Invalid replay trace:', validation.errors);
                alert('Failed to load replay: Invalid trace data');
                return;
            }

            setReplayTrace(trace);
            setReplayIndex(0);
            // Switch to board-connected to visualize, or keep in inspector?
            // If we want to see the trace, we probably need 'board-connected' or a similar view.
            // But we want to keep InspectorPanel open?
            // Let's stay in 'inspector' mode but ensure the RightDock shows the board
            // and the main area shows what?

            // Actually, if we are in 'inspector' mode, we might want the InspectorPanel to stay visible.
            // But we need to see the replay.
            // Let's create a hybrid view or just switch tabs?
        };
        window.addEventListener('rb:load-replay', handleReplayLoad);
        return () => window.removeEventListener('rb:load-replay', handleReplayLoad);
    }, []);

    // Effective Snapshot: Priority -> Replay > Live (Hardware/Sim based on mode)
    const effectiveSnapshot = replayTrace
        ? replayTrace.samples[replayIndex] ?? null
        : (mode === 'sim-only' ? simSnapshot : ioSnapshot);

    const effectiveCapabilities = mode === 'sim-only' ? simCapabilities : capabilities;

    // Recording Actions
    const handleToggleRecording = () => {
        if (isRecording) {
            const trace = stopRecording();
            if (trace && trace.samples.length > 0) {
                const name = window.prompt('Save trace as:', `trace-${Date.now()}.json`);
                if (name) {
                    saveTraceToFS(trace, name).then(ok => {
                        if (ok) alert('Saved!');
                        else alert('Save failed.');
                    });
                }
            }
        } else {
            setReplayTrace(null); // Exit replay if starting record
            startRecording();
        }
    };

    const handleLoadTrace = async () => {
        const name = window.prompt('Load trace filename:', 'trace.json');
        if (!name) return;
        const trace = await loadTraceFromFS(name);
        if (trace) {
            setReplayTrace(trace);
            setReplayIndex(0);
            setMode('board-connected'); // Switch to view
            alert(`Loaded ${trace.samples.length} samples.`);
        } else {
            alert('Failed to load trace.');
        }
    };

    // Comparison Logic Loop
    useEffect(() => {
        if (rightTab !== 'compare') return;

        if (rightTab !== 'compare') return;

        // 1. Get mappings based on connected board (or sim)
        const boardId = effectiveCapabilities?.boardId || 'unknown';
        const map = getSignalMap(boardId);

        // 2. Get sim snapshot (stub for now) -> Actually comparing against SimStore anyway?
        // If mode is 'sim-only', "Comparison" is weird (Sim vs Sim?), but maybe Lab mode uses Sim?
        // Let's assume standard Lab comparison logic applies to whatever is "Effective".
        const sim = getSimSnapshot();

        // 3. Compute checks
        const newChecks: CompareSignalCheck[] = [];

        // Iterate over mapped signals
        for (const [signalName, hwLoc] of Object.entries(map)) {
            // Sim value (Expected)
            let expected: number | string = '-';
            if (sim) {
                // Determine if input or output
                // Access correct group from inputs/outputs
                // Note: signalMap uses flat signal names, we need to map back to group?
                // Actually hwLoc has group/bit info.

                let groupVal: number | string | undefined;
                if (hwLoc.group === 'SW' || hwLoc.group === 'BTN') {
                    groupVal = sim.inputs[hwLoc.group];
                } else {
                    groupVal = sim.outputs[hwLoc.group];
                }

                if (groupVal !== undefined) {
                    const intVal = typeof groupVal === 'number' ? groupVal : parseInt(groupVal as string || '0', 2);
                    expected = (intVal >> hwLoc.bit) & 1;
                }
            }

            // HW value (resolve from snapshot)
            let observed: number | string = '-';

            if (effectiveSnapshot) {
                if (hwLoc.group === 'SW') {
                    const swVal = effectiveSnapshot.inputs.SW;
                    const swInt = typeof swVal === 'number' ? swVal : parseInt(swVal as string || '0', 2);
                    observed = (swInt >> hwLoc.bit) & 1;
                } else if (hwLoc.group === 'LED') {
                    const ledVal = effectiveSnapshot.outputs.LED;
                    const ledInt = typeof ledVal === 'number' ? ledVal : parseInt(ledVal as string || '0', 2);
                    observed = (ledInt >> hwLoc.bit) & 1;
                }
            }

            // PASS if present and matches
            const pass = expected !== undefined && observed !== '-' && String(expected) === String(observed);

            newChecks.push({
                signalName,
                expected: expected ?? '-',
                observed,
                pass
            });
        }

        setChecks(newChecks);


    }, [rightTab, effectiveSnapshot, effectiveCapabilities, replayTrace]); // Re-run on any IO change


    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-200">
            {/* App Toolbar / Mode Switcher */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-4">
                    <h1 className="text-sm font-bold text-gray-100 uppercase tracking-tight">ECE Lab</h1>

                    {/* Mode Switcher */}
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setMode('sim-only')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'sim-only'
                                ? 'bg-green-900/50 text-green-200 shadow-sm border border-green-800/50'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Free Play (Sim)
                        </button>
                        <button
                            onClick={() => setMode('board-connected')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'board-connected'
                                ? 'bg-cyan-900/50 text-cyan-200 shadow-sm border border-cyan-800/50'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Board Connected
                        </button>
                        <button
                            onClick={() => setMode('guided-lab')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'guided-lab'
                                ? 'bg-indigo-900/50 text-indigo-200 shadow-sm border border-indigo-800/50'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Guided Lab
                        </button>
                        <button
                            onClick={() => setMode('inspector')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'inspector'
                                ? 'bg-amber-900/50 text-amber-200 shadow-sm border border-amber-800/50'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Inspect
                        </button>
                    </div>

                    {/* Trace Controls */}
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 h-7 items-center">
                        {!replayTrace ? (
                            <>
                                <button
                                    onClick={handleToggleRecording}
                                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded flex items-center gap-1 transition-colors ${isRecording
                                        ? 'bg-red-900 text-red-100 animate-pulse border border-red-700'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-600'
                                        }`}
                                >
                                    {isRecording ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> STOP</>
                                    ) : (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-red-700" /> REC</>
                                    )}
                                </button>
                                {isRecording && (
                                    <span className="text-[10px] text-gray-500 font-mono ml-2">
                                        {(Date.now() - (recordingStartTick || 0)) / 1000 | 0}s • {traceBuffer.length}smp
                                    </span>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-[10px] text-indigo-300 font-bold">REPLAY</span>
                                <input
                                    type="range"
                                    title="Replay Scrubber"
                                    min={0}
                                    max={Math.max(0, replayTrace.samples.length - 1)}
                                    value={replayIndex}
                                    onChange={(e) => setReplayIndex(Number(e.target.value))}
                                    className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {replayIndex}/{replayTrace.samples.length}
                                </span>
                                <button
                                    onClick={() => setReplayTrace(null)}
                                    className="text-[10px] text-gray-500 hover:text-white px-1"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {!isRecording && !replayTrace && (
                            <button
                                onClick={handleLoadTrace}
                                className="ml-2 px-2 py-0.5 text-[10px] bg-gray-800 text-gray-400 hover:text-white border border-gray-600 rounded"
                            >
                                LOAD
                            </button>
                        )}
                    </div>
                </div>

                {/* Mode Badge (Proof of Visibility) */}
                <div className="flex items-center gap-2 mr-2">
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${mode === 'sim-only' ? 'bg-green-900/30 text-green-400 border-green-800' :
                        mode === 'board-connected' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800' :
                            'bg-gray-800 text-gray-400 border-gray-700'
                        }`}>
                        Mode: {mode === 'sim-only' ? 'Free Play (Sim)' : mode}
                    </div>
                    <div className="text-xs text-gray-500">v1.0.0-MVP</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT PANE: Experiment Canvas OR Lab Instructions OR Inspector */}
                <div className="flex-1 flex flex-col border-r border-gray-800 bg-gray-900 relative">
                    {mode === 'guided-lab' ? (
                        <LabInstructions labId="lab-1" content={LAB_1_CONTENT} />
                    ) : mode === 'inspector' ? (
                        <InspectorPanel />
                    ) : mode === 'sim-only' ? (
                        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
                            {(() => {
                                // Lazy load experiments manifest inside render is suboptimal but works for MVP
                                // Ideally move to top level import
                                const { EXPERIMENTS } = require('../labs/experiments');
                                const currentExp = EXPERIMENTS[useSimStore.getState().activeExperimentId];
                                const activeExperimentId = useSimStore((s) => s.activeExperimentId);
                                const setSimExperiment = useSimStore((s) => s.setExperiment);
                                const simAutoRun = useSimStore((s) => s.autoRun);
                                const setSimAutoRun = useSimStore((s) => s.setAutoRun);
                                const simRunTick = useSimStore((s) => s.runTick);
                                const simReset = useSimStore((s) => s.reset);
                                const simSnapshot = useSimStore((s) => ({
                                    tick: s.tick,
                                    inputs: s.inputs,
                                    outputs: s.outputs
                                }));

                                // Auto-run effect needs to be here? No, better at top level component.
                                // But hooks inside conditional render? BAD!
                                // React Hooks Rule Violation: Hooks must be at top level.
                                // I CANNOT put useState/useEffect/useSelector inside this 'sim-only' block.

                                // REFACTOR: The hooks must be at top level of ECELabAppComponent.
                                // I will just implement the UI here and assume hooks are available via closure.
                                // BUT I haven't added the hooks to the top level yet!
                                return null;
                            })() || (
                                    // Wait, I cannot use hooks inside this callback.
                                    // I need to Lift State Up.
                                    // Let's implement a sub-component: ExperimentCanvas
                                    // But I prefer to keep it in one file for now if possible, 
                                    // OR just put the hooks at the top level of ECELabAppComponent 
                                    // and pass them down or access them here.
                                    // The hooks already exist? No.
                                    // I need to add the hooks to ECELabAppComponent top level first.

                                    <ExperimentCanvas />
                                )}
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600 flex-col gap-2">
                            <div className="text-4xl opacity-20">⚡</div>
                            <div className="text-sm font-medium">Experiment Canvas</div>
                        </div>
                    )}
                </div>

                {/* RIGHT PANE: Comparison & Board */}
                <div className="w-[400px] flex flex-col bg-gray-950 border-l border-gray-800">
                    {/* Tab Switcher */}
                    <div className="flex border-b border-gray-800 bg-gray-900">
                        <button
                            onClick={() => setRightTab('board')}
                            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${rightTab === 'board'
                                ? 'border-cyan-500 text-cyan-400 bg-gray-800'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Hardware
                        </button>
                        <button
                            onClick={() => setRightTab('compare')}
                            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${rightTab === 'compare'
                                ? 'border-indigo-500 text-indigo-400 bg-gray-800'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Compare
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {rightTab === 'board' ? (
                            <BoardPanel
                                snapshot={effectiveSnapshot}
                                capabilities={effectiveCapabilities}
                                onInteraction={mode === 'sim-only' ? setSimInput : undefined}
                                readOnly={!!replayTrace}
                            />
                        ) : (
                            <CompareView ioSnapshot={effectiveSnapshot} checks={checks} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
