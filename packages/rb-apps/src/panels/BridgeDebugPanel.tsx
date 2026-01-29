import React, { useEffect, useState } from 'react';
import { hardwareClient, ConnectionState } from '../services/hardwareClient';

export const BridgeDebugPanel: React.FC = () => {
    const [state, setState] = useState<ConnectionState>(hardwareClient.getState());
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        return hardwareClient.subscribe(setState);
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-1 right-1 bg-red-900/80 text-[10px] text-white p-1 rounded z-[9999] hover:bg-red-800"
            >
                BRIDGE DEBUG
            </button>
        );
    }

    return (
        <div className="fixed bottom-1 right-1 w-[400px] h-[300px] bg-black/90 border border-red-500/30 text-xs font-mono text-green-400 p-2 overflow-auto z-[9999] shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1 mb-2">
                <span className="font-bold text-white">BRIDGE TRUTH PANEL</span>
                <button onClick={() => setIsOpen(false)} className="text-red-500 hover:text-red-400">[X]</button>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="text-gray-500 uppercase tracking-widest text-[10px]">Connection State</div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${state.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-bold">{state.status.toUpperCase()}</span>
                    </div>
                    {state.status === 'connected' && (
                        <div className="ml-4 text-gray-400">
                            WS Connected: {state.ws ? 'YES' : 'NO'}
                        </div>
                    )}
                </div>

                <div>
                    <div className="text-gray-500 uppercase tracking-widest text-[10px] flex justify-between">
                        <span>Discovered Devices</span>
                        <span>{state.status === 'connected' ? state.devices.length : 0} found</span>
                    </div>
                    {state.status === 'connected' && state.devices.length > 0 ? (
                        <div className="space-y-1 mt-1">
                            {state.devices.map((d, i) => (
                                <div key={i} className="bg-gray-900 p-1 rounded border border-gray-800">
                                    <div className="text-white font-bold">{d.deviceId} <span className="text-gray-500">({d.boardModel})</span></div>
                                    <div className="text-gray-500 text-[10px]">
                                        Port: <span className="text-yellow-500">{d.runtime?.port || d.status}</span>
                                    </div>
                                    <div className="text-gray-600 text-[10px]">Target: {d.toolchain || 'unknown'}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-red-500 italic">No devices found in Truth Store.</div>
                    )}
                </div>

                <div>
                    <div className="text-gray-500 uppercase tracking-widest text-[10px]">Message Log</div>
                    <div className="text-gray-400 opacity-50">
                        {state.status === 'offline' && (state as any).message}
                    </div>
                </div>
            </div>
        </div>
    );
};
