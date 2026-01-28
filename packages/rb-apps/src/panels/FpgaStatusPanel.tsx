import React, { useEffect, useState } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';

export const FpgaStatusPanel: React.FC = () => {
    const isRunning = useLabStore(state => state.simulation.isRunning);
    const playbackMode = useLabStore(state => state.simulation.playbackMode);
    const graph = useLabStore(state => state.graph);

    const fpgaNode = graph.nodes.find(n => n.type === 'fpga-basys3');

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
                <div className="flex justify-between">
                    <span>State:</span>
                    <span className={`font-mono ${playbackMode === 'replay' ? 'text-amber-500' : isRunning ? 'text-green-500' : 'text-gray-500'}`}>
                        {playbackMode === 'replay' ? 'REPLAY' : isRunning ? 'RUNNING' : 'IDLE'}
                    </span>
                </div>
            </div>

            {/* Placeholder for Bitstream Load */}
            <div className="mt-3 pt-2 border-t border-gray-700 opacity-50">
                <button className="w-full bg-gray-800 text-gray-500 py-1 rounded cursor-not-allowed text-[10px]" disabled>
                    Load Bitstream (Stub)
                </button>
            </div>
        </div>
    );
};
