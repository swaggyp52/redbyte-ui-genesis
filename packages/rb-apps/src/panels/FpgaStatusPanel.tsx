import React, { useEffect, useState } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';
import { FPGA_PRESET_DEFS } from '@redbyte/rb-logic-3d/src/lab-model/fpga-sim/presets';

export const FpgaStatusPanel: React.FC = () => {
    const isRunning = useLabStore(state => state.simulation.isRunning);
    const playbackMode = useLabStore(state => state.simulation.playbackMode);
    const graph = useLabStore(state => state.graph);

    const fpgaNode = graph.nodes.find(n => n.type === 'fpga-basys3');
    const partState = useLabStore(state => fpgaNode ? state.simulation.partStates[fpgaNode.id] : undefined);

    // We need to access the store getters directly or add a selector?
    // Since getTransportStatus is a function, we can't select it easily for reactivity if it's not state.
    // The store needs a 'transportStatus' field if we want reactive updates.
    // For now, let's just force a re-render or assume it doesn't change often.
    // Or we can use a "tick" effect to poll it?
    // Better: Add `transportType` to `LabStoreState` properly?
    // Plan B: Just call `useLabStore.getState().getTransportStatus()` on mount/interval.
    const [activeTransportStatus, setTransportStatus] = useState(useLabStore.getState().getTransportStatus());

    useEffect(() => {
        const interval = setInterval(() => {
            const status = useLabStore.getState().getTransportStatus();
            setTransportStatus(prev => {
                if (prev.type !== status.type || prev.connected !== status.connected) return status;
                return prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const [selectedPreset, setSelectedPreset] = useState(FPGA_PRESET_DEFS[0].id);

    // Sync selected preset with active if available
    const activePresetId = partState?.preset;
    const activePresetName = activePresetId ? FPGA_PRESET_DEFS.find(d => d.id === activePresetId)?.name : 'Passthrough (Default)';

    const handleLoad = () => {
        if (fpgaNode && selectedPreset) {
            useLabStore.getState().loadFpgaPreset(fpgaNode.id, selectedPreset);
        }
    };

    // Simple auto-update for visual flair
    const [blink, setBlink] = useState(false);
    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => setBlink(b => !b), 500);
        return () => clearInterval(interval);
    }, [isRunning]);

    if (!fpgaNode) return null;

    return (
        <div className="absolute top-16 right-4 w-64 bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 text-xs shadow-xl select-none">
            <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2">
                <span className="font-bold text-gray-300">Basys3 FPGA Status</span>
                {isRunning && (
                    <div className={`w-2 h-2 rounded-full ${blink ? 'bg-green-500' : 'bg-green-800'}`} />
                )}
            </div>

            <div className="space-y-1 text-gray-400">
                <div className="flex justify-between">
                    <span>Clock:</span>
                    <span className="font-mono text-gray-200">100 MHz (Sim)</span>
                </div>
                <div className="flex justify-between">
                    <span>Model:</span>
                    <span className="font-mono text-gray-200">XC7A35T-1CPG236C</span>
                </div>
            </div>
            <div className="flex justify-between">
                <span>State:</span>
                <span className={`font-mono ${playbackMode === 'replay' ? 'text-amber-500' : isRunning ? 'text-green-500' : 'text-gray-500'}`}>
                    {playbackMode === 'replay' ? 'REPLAY' : isRunning ? 'RUNNING' : 'IDLE'}
                </span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                <span>Mode:</span>
                {activeTransportStatus.type === 'bridge' ? (
                    <span className={`font-mono ${activeTransportStatus.connected ? 'text-cyan-400' : 'text-red-500'}`}>
                        BRIDGE {activeTransportStatus.connected ? '' : '(OFFLINE)'}
                    </span>
                ) : (
                    <span className="font-mono text-blue-400">SIMULATION</span>
                )}
                )}
            </div>

            {/* Preset Loader */}
            <div className="mt-3 pt-2 border-t border-gray-700">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Design Loader</label>
                    <select
                        className="bg-black border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500"
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        disabled={playbackMode === 'replay'}
                        title="Select FPGA Design"
                    >
                        {FPGA_PRESET_DEFS.map(def => (
                            <option key={def.id} value={def.id}>
                                {def.name}
                            </option>
                        ))}
                    </select>

                    <button
                        className={`px-3 py-1 rounded text-white font-bold transition-colors ${playbackMode === 'replay' ? 'bg-gray-700 cursor-not-allowed text-gray-500' :
                            'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
                            }`}
                        onClick={handleLoad}
                        disabled={playbackMode === 'replay'}
                    >
                        Load Bitstream
                    </button>
                    {!fpgaNode && <span className="text-red-500 text-[10px]">No FPGA Found</span>}
                    {playbackMode === 'replay' && <span className="text-amber-500 text-[10px]">Disabled in Replay</span>}
                </div>
            </div>
        </div>
    );
};

