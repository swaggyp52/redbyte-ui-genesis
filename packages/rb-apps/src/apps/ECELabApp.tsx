import React, { useState, useEffect } from 'react';
import BoardPanel from '../components/BoardPanel';
import { CompareView, type CompareSignalCheck } from '../components/CompareView';
import { useHardwareStore } from '../stores/hardwareStore';
import { getSignalMap } from '../labs/signalMap';
import { getSimSnapshot } from '../labs/simAdapter';
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

    // Effective Snapshot: Live vs Replay
    const effectiveSnapshot = replayTrace
        ? replayTrace.samples[replayIndex] ?? null
        : ioSnapshot;

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

        // 1. Get mappings based on connected board
        const boardId = capabilities?.boardId || 'unknown';
        const map = getSignalMap(boardId);

        // 2. Get sim snapshot (stub for now)
        const sim = getSimSnapshot();

        // 3. Compute checks
        const newChecks: CompareSignalCheck[] = [];

        // Iterate over mapped signals
        for (const [signalName, hwLoc] of Object.entries(map)) {
            // Sim value
            const expected = sim.signals[signalName];

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

    }, [rightTab, effectiveSnapshot, capabilities, replayTrace]); // Re-run on any IO change


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
                                ? 'bg-gray-700 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Sim Only
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

                {/* Toolbar Actions placeholder */}
                <div className="text-xs text-gray-500">v1.0.0-MVP</div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT PANE: Experiment Canvas OR Lab Instructions OR Inspector */}
                <div className="flex-1 flex flex-col border-r border-gray-800 bg-gray-900 relative">
                    {mode === 'guided-lab' ? (
                        <LabInstructions />
                    ) : mode === 'inspector' ? (
                        <InspectorPanel />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600 flex-col gap-2">
                            <div className="text-4xl opacity-20">⚡</div>
                            <div className="text-sm font-medium">Experiment Canvas</div>
                            <div className="text-xs text-gray-500">
                                {mode === 'sim-only' && 'Build and simulate circuits here (Coming Soon)'}
                                {mode === 'board-connected' && 'Live hardware I/O visualization active'}
                            </div>
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
                            <BoardPanel />
                        ) : (
                            <CompareView ioSnapshot={effectiveSnapshot} checks={checks} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
