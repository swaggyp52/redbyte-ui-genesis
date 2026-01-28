// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { type RedByteCapsule } from '../hardware/capsuleFormat';
import { loadCapsuleFromFS } from '../utils/traceFileUtils';
import { PanelLayout } from '../components/PanelLayout';

export const InspectorPanel: React.FC = () => {
    const [capsule, setCapsule] = useState<RedByteCapsule | null>(null);
    const [error, setError] = useState<string | null>(null);
    const disconnect = useHardwareStore((s) => s.disconnect);

    // For file picker (MVP: Text input for file path/ID)
    // Ideally use FS modal, but input is faster for MVP
    const [fileId, setFileId] = useState('');

    const handleLoad = async () => {
        setError(null);
        if (!fileId) return;

        const loaded = await loadCapsuleFromFS(fileId);
        if (loaded) {
            setCapsule(loaded);
        } else {
            setError('Failed to load. Check Filename/ID.');
        }
    };

    const handleWatchTrace = async () => {
        if (!capsule?.trace) {
            setError('No trace in capsule.');
            return;
        }

        // Safety: disconnect live hardware first
        disconnect();
    };

    return (
        <PanelLayout
            className="w-80 border-l border-gray-800 bg-gray-900"
            header={
                <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-100">Inspector</span>
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Debug</span>
                </div>
            }
            bodyClassName="p-4"
        >
            {/* Loader */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={fileId}
                    onChange={e => setFileId(e.target.value)}
                    placeholder="Enter filename (e.g. lab1-evidence...)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500"
                />
                <button
                    onClick={handleLoad}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded font-medium"
                >
                    Load
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-900 rounded mb-4 text-xs text-red-400">
                    {error}
                </div>
            )}

            {capsule ? (
                <div className="space-y-4 animate-fade-in">
                    {/* Status Badge */}
                    <div className={`p-4 rounded-lg border flex items-center justify-between ${capsule.result?.status === 'pass'
                        ? 'bg-green-900/20 border-green-800'
                        : 'bg-red-900/20 border-red-800'
                        }`}>
                        <div>
                            <div className="text-[10px] items-center text-gray-500 uppercase font-bold">Status</div>
                            <div className={`text-lg font-bold ${capsule.result?.status === 'pass' ? 'text-green-400' : 'text-red-400'}`}>
                                {capsule.result?.status === 'pass' ? 'PASSED' : 'INCOMPLETE'}
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 font-mono text-right">
                            {new Date(capsule.timestamp).toLocaleTimeString()}
                            <div className="text-[10px] opacity-50">{new Date(capsule.timestamp).toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Lab ID</span>
                            <span className="text-gray-300 font-mono">{capsule.labId}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Board</span>
                            <span className="text-gray-300 font-mono">{capsule.deviceBoardId || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Key</span>
                            <span className="text-gray-300 font-mono truncate max-w-[120px]" title={capsule.deviceKey}>
                                {capsule.deviceKey || 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-500">Trace Samples</span>
                            <span className="text-cyan-400 font-mono">{capsule.trace?.samples.length || 0}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('rb:load-replay', { detail: capsule.trace }))}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <span>▶</span> Watch Replay
                    </button>
                    <div className="text-[10px] text-gray-500 text-center">
                        Click to load trace into player
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-600 text-xs">
                    No evidence loaded.
                </div>
            )}
        </PanelLayout>
    );
};
