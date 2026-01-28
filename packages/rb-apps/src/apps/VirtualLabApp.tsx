import React, { useEffect, useState, useRef } from 'react';
import { Rb3DSceneLab, useLabStore, PART_DEFINITIONS, LabNode, validateLabGraph, validateTimeline, repairLabGraph, repairTimeline, fingerprintCapsuleContent } from '@redbyte/rb-logic-3d';
import type { RedByteApp } from '../types';

const VirtualLabAppComponent: React.FC = () => {
    const addNode = useLabStore((state) => state.addNode);
    const reset = useLabStore((state) => state.reset);
    const runSimulationStep = useLabStore((state) => state.runSimulationStep);
    const toggleSimulation = useLabStore((state) => state.toggleSimulation);
    const setPlaybackMode = useLabStore((state) => state.setPlaybackMode);
    const scrub = useLabStore((state) => state.scrub);
    const recover = useLabStore((state) => state.recover);

    // Selectors
    const isRunning = useLabStore((state) => state.simulation.isRunning);
    const tick = useLabStore((state) => state.simulation.tick);
    const playbackMode = useLabStore((state) => state.simulation.playbackMode);
    const replayScrubTick = useLabStore((state) => state.simulation.replayScrubTick);
    const integrityError = useLabStore((state) => state.integrityError);

    // Export/Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Simulation Loop (20Hz)
    useEffect(() => {
        let interval: number;
        if (isRunning && playbackMode === 'live') {
            interval = window.setInterval(() => {
                runSimulationStep();
            }, 50);
        }
        return () => window.clearInterval(interval);
    }, [isRunning, runSimulationStep, playbackMode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => useLabStore.getState().reset();
    }, []);

    const handleAddPart = (type: string) => {
        if (playbackMode === 'replay') {
            window.alert('Cannot edit graph in Replay Mode. Switch to Live Mode first.');
            return;
        }

        const def = PART_DEFINITIONS[type];
        if (!def) return;

        const count = useLabStore.getState().graph.nodes.length;

        // Smarter default placements for automatic MVP success
        let pose = { position: { x: count * 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

        if (type === 'breadboard-half') {
            pose.position = { x: 0, y: 0, z: 0 };
        } else if (type === 'arduino-nano') {
            pose.position = { x: -3, y: 0, z: 0 };
        } else if (type === 'led-5mm') {
            pose.position = { x: 1, y: 0.5, z: 0 };
        }

        const node: LabNode = {
            id: `${type}-${Date.now()}`,
            type,
            pose,
            properties: {},
        };

        addNode(node);
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        const t = parseInt(e.target.value);
        scrub(t);
    };

    const handleExportCapsule = async () => {
        const state = useLabStore.getState();
        const headerSnapshot = state.timeline.snapshots[0];

        // Prepare Content
        const capsuleContent = {
            meta: {
                capsuleVersion: 'labcapsule.v1',
                engineVersion: '1.0.0',
                appVersion: '1.0.0',
                createdAt: new Date().toISOString(),
                seed: 0, // Deterministic seed placeholder
            },
            graph: headerSnapshot.graph,
            history: {
                events: state.timeline.events,
                snapshots: state.timeline.snapshots
            }
        };

        // Compute Canonical Hash
        const hashHex = await fingerprintCapsuleContent(capsuleContent);

        const capsule = {
            meta: { ...capsuleContent.meta, deterministicHash: hashHex },
            graph: capsuleContent.graph,
            history: capsuleContent.history
        };

        const blob = new Blob([JSON.stringify(capsule, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab-replay-${Date.now()}.labcapsule.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportCapsule = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            // ASYNC handling for import
            try {
                const json = JSON.parse(ev.target?.result as string);

                // 1. Version Check
                if (json.meta?.capsuleVersion !== 'labcapsule.v1') {
                    throw new Error(`Unsupported capsule version: ${json.meta?.capsuleVersion}`);
                }

                // 2. Budget Guards
                const eventCount = json.history?.events?.length || 0;
                if (eventCount > 200000) {
                    alert(`Capsule too large (${eventCount} events). Import rejected for safety.`);
                    return;
                }

                // 3. Validation
                const graphValid = validateLabGraph(json.graph);
                const timelineValid = validateTimeline(json.history);

                let graphToLoad = json.graph;
                let historyToLoad = json.history;
                let integrityErrorMsg: string | undefined = undefined;
                let loadedAsReadOnly = true; // Default to read-only for imported evidence

                // 4. Hash Verification
                const expectedHash = json.meta?.deterministicHash;
                const actualHash = await fingerprintCapsuleContent({
                    meta: json.meta,
                    graph: json.graph,
                    history: json.history
                });

                const hashMatch = expectedHash === actualHash;

                if (!hashMatch) {
                    const proceed = window.confirm(
                        `Integrity Warning!\n\nThe capsule hash does not match its content.\nExpected: ${expectedHash?.slice(0, 8)}...\nActual: ${actualHash.slice(0, 8)}...\n\nThe file may have been modified or corrupted.\n\nLoad explicitly as READ-ONLY (Unverified)?`
                    );
                    if (!proceed) return;
                    integrityErrorMsg = "Hash Mismatch - Unverified";
                } else if (!graphValid.valid || !timelineValid.valid) {
                    // 5. Corruption & Repair
                    const repair = window.confirm(
                        `Corruption Detected!\n\nGraph Errors: ${graphValid.errors.length}\nTimeline Errors: ${timelineValid.errors.length}\n\nAttempt to repair and partial load?`
                    );
                    if (!repair) return;

                    const gRep = repairLabGraph(json.graph);
                    const tRep = repairTimeline(json.history);

                    graphToLoad = gRep.repaired;
                    historyToLoad = tRep.repaired;
                    integrityErrorMsg = `Repaired (${gRep.warnings.length + tRep.warnings.length} fixes)`;

                    if (gRep.warnings.length > 0) console.warn("Graph Repairs:", gRep.warnings);
                    if (tRep.warnings.length > 0) console.warn("Timeline Repairs:", tRep.warnings);
                } else {
                    // Valid & Verified
                    loadedAsReadOnly = true;
                }

                // Hydrate Store
                useLabStore.setState({
                    graph: graphToLoad,
                    timeline: historyToLoad,
                    simulation: {
                        isRunning: false,
                        tick: historyToLoad.events[historyToLoad.events.length - 1]?.tick || 0,
                        pinStates: {},
                        playbackMode: loadedAsReadOnly ? 'replay' : 'live', // Usually imports are evidence -> replay
                        replayScrubTick: 0,
                    },
                    integrityError: integrityErrorMsg || null
                });

                // Force derive initial state
                scrub(0);

            } catch (err) {
                console.error(err);
                window.alert('Failed to load capsule. See console.');
            }

            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex h-full w-full bg-[#1e1e1e] text-gray-200 overflow-hidden">
            {/* Sidebar / Palette */}
            <div className="w-64 flex flex-col border-r border-gray-700 bg-[#252526]">
                <div className="p-3 font-semibold text-sm border-b border-gray-700 uppercase tracking-wider text-gray-500">
                    Parts Palette
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {Object.values(PART_DEFINITIONS).map((part) => (
                        <button
                            key={part.type}
                            onClick={() => handleAddPart(part.type)}
                            disabled={playbackMode === 'replay' || !!integrityError}
                            className={`w-full text-left px-3 py-2 rounded bg-[#333] hover:bg-[#444] transition-colors flex items-center gap-2 group ${playbackMode === 'replay' || integrityError ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="w-6 h-6 rounded bg-gray-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-blue-500">
                                +
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-medium text-white">{part.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{part.type}</div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="p-2 border-t border-gray-700 space-y-2">
                    <button
                        onClick={handleExportCapsule}
                        className="w-full px-3 py-2 rounded bg-blue-900/50 hover:bg-blue-900 text-blue-100 text-xs transition-colors flex items-center justify-center gap-2"
                    >
                        <span>💾</span> Export Capsule
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs transition-colors"
                    >
                        📂 Import Capsule
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportCapsule} accept=".json" className="hidden" title="Upload Capsule Input" />

                    <div className="h-px bg-gray-700 my-2" />

                    <button
                        onClick={() => reset()}
                        className="w-full px-3 py-2 rounded bg-red-900/50 hover:bg-red-900 text-red-100 text-xs transition-colors"
                    >
                        Clear Bench
                    </button>
                </div>
            </div>

            {/* Main 3D View */}
            <div className={`flex-1 relative bg-black ${playbackMode === 'replay' ? 'border-4 border-amber-500 box-border' : ''} ${integrityError ? 'border-4 border-red-600 box-border' : ''}`}>
                <Rb3DSceneLab />

                {/* Overlay UI */}
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur rounded px-3 py-1.5 text-xs text-gray-300 pointer-events-none">
                    Virtual Lab Bench (MVP)
                </div>

                {/* Replay Mode / Integrity Indicator */}
                <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
                    {integrityError && (
                        <div className="bg-red-600 text-white font-bold px-4 py-1 rounded-full shadow-lg animate-pulse flex items-center gap-2">
                            <span>⚠️ {integrityError}</span>
                        </div>
                    )}
                    {playbackMode === 'replay' && (
                        <div className="bg-amber-600 text-black font-bold px-4 py-1 rounded-full shadow-lg">
                            REPLAY MODE (READ ONLY)
                        </div>
                    )}
                </div>

                {/* Integrity Recovery UI */}
                {integrityError && (
                    <div className="absolute top-16 right-4 pointer-events-auto">
                        <button
                            onClick={() => recover()}
                            className="bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded text-xs shadow-lg border border-red-500"
                        >
                            Recover Last Good State
                        </button>
                    </div>
                )}

                {/* Simulation Control */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#222] flex flex-col items-center gap-2 rounded-xl px-6 py-3 shadow-2xl border border-gray-600 min-w-[400px]">

                    {/* Top Row: Play/Pause/Mode */}
                    <div className="flex items-center gap-6 w-full justify-center">
                        {/* Mode Toggle */}
                        <div className="flex bg-black rounded p-0.5">
                            <button
                                onClick={() => setPlaybackMode('live')}
                                disabled={!!integrityError}
                                className={`px-3 py-1 text-xs rounded ${playbackMode === 'live' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'} ${integrityError ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                                LIVE
                            </button>
                            <button
                                onClick={() => setPlaybackMode('replay')}
                                className={`px-3 py-1 text-xs rounded ${playbackMode === 'replay' ? 'bg-amber-600 text-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                REPLAY
                            </button>
                        </div>

                        {/* Play Button */}
                        <button
                            onClick={() => toggleSimulation()}
                            disabled={playbackMode === 'replay' || !!integrityError}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors text-xl shadow-lg
                                ${playbackMode === 'replay' || integrityError ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                                    isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                        >
                            {isRunning ? '⬛' : '▶'}
                        </button>

                        {/* Tick Display */}
                        <div className="flex flex-col items-start w-20">
                            <span className="text-[10px] uppercase font-bold text-gray-500">Tick</span>
                            <span className="text-xl font-mono text-white leading-none">
                                {playbackMode === 'live' ? tick : replayScrubTick} <span className="text-xs text-gray-500">/ {tick}</span>
                            </span>
                        </div>
                    </div>

                    {/* Bottom Row: Scrubber */}
                    <div className="w-full pt-2 flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-mono">0</span>
                        <input
                            type="range"
                            min={0}
                            max={tick}
                            value={playbackMode === 'live' ? tick : replayScrubTick}
                            onChange={handleScrub}
                            /* When scrubbing in Live mode, we should ideally auto-switch to replay, but for MVP keep explicit */
                            onMouseDown={() => { if (playbackMode === 'live') setPlaybackMode('replay'); }}
                            title="Timeline Scrubber"
                            className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer
                                ${playbackMode === 'replay' ? 'bg-amber-900 accent-amber-500' : 'bg-gray-700 accent-blue-500'}`}
                        />
                        <span className="text-xs text-gray-500 font-mono">{tick}</span>
                    </div>

                </div>

                {/* Help */}
                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur p-4 rounded text-xs text-gray-400 pointer-events-none max-w-xs">
                    <p className="font-bold text-white mb-1">Controls:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Click pin to start wire</li>
                        <li>Connect D13 to LED Anode</li>
                        <li>Switch to <strong>REPLAY</strong> to scrub history</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export const VirtualLabApp: RedByteApp = {
    manifest: {
        id: 'virtual-lab',
        name: 'Virtual Lab',
        iconId: 'tool-build',
        category: 'tools',
        defaultSize: { width: 1200, height: 800 },
        minSize: { width: 800, height: 600 },
    },
    component: VirtualLabAppComponent,
};
