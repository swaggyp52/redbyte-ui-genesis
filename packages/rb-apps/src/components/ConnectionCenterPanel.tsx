import React from 'react';
import { Icon } from '@redbyte/rb-icons';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { useCapabilitiesStore } from '../stores/capabilitiesStore';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';

/**
 * ConnectionCenterPanel: The single source of truth for Hardware/System status.
 * Reusable across Labs, Shell, and Diagnostics.
 */
export const ConnectionCenterPanel: React.FC = () => {
    const { bridge, sessions, ensureSession, disconnect } = useHardwareSessionStore();
    const { hardware: hwCap, studentMode } = useCapabilitiesStore();
    const { hardwareSnapshots } = useLabWorkflowStore();

    const isBasys3Connected = sessions.basys3.status === 'connected';
    const bridgeStatus = bridge.status;

    return (
        <div className="flex flex-col gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl">
            {/* Bridge Status Section */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                        bridgeStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                        }`} />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Bridge: {bridgeStatus.toUpperCase()}
                    </span>
                </div>
                {bridgeStatus === 'online' && (
                    <span className="text-[10px] font-mono text-slate-500">
                        v{bridge.version || '1.0.0'}
                    </span>
                )}
            </div>

            {/* Hardware Selection/Status */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">Basys 3 Board</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {isBasys3Connected ? `Connected on ${sessions.basys3.port}` : 'Not connected'}
                        </span>
                    </div>
                    <button
                        onClick={() => isBasys3Connected ? disconnect('basys3') : ensureSession('basys3', 'COM7')}
                        disabled={bridgeStatus !== 'online'}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isBasys3Connected
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                    >
                        {isBasys3Connected ? 'Disconnect' : 'Connect COM7'}
                    </button>
                </div>

                {isBasys3Connected && (
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-600 font-black uppercase tracking-tighter">
                            <span>Live I/O Heartbeat</span>
                            <span className="text-indigo-400 flex items-center gap-1">
                                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-ping" />
                                Active
                            </span>
                        </div>
                        <div className="flex justify-between font-mono text-[11px] text-slate-300">
                            <span>Last Data:</span>
                            <span>{sessions.basys3.lastIoAt ? new Date(sessions.basys3.lastIoAt).toLocaleTimeString() : 'Never'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Evidence/Proof Section */}
            <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collected Evidence</span>
                    <span className="text-xs font-bold text-emerald-400">{hardwareSnapshots.length} Snapshots</span>
                </div>

                {!isBasys3Connected && (
                    <div className="py-8 text-center text-slate-600 italic text-xs">
                        Connect hardware to capture proofs.
                    </div>
                )}
            </div>

            {/* Errors if any */}
            {sessions.basys3.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-start gap-2">
                    {React.createElement(Icon as any, { name: 'browser', size: 16, className: 'text-red-400 mt-0.5' })}
                    <span className="text-[10px] text-red-300 font-medium">{sessions.basys3.error}</span>
                </div>
            )}
        </div>
    );
};
